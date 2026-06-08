import { Inject } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { type PublicClient, type WalletClient } from 'viem'
import { PUBLIC_CLIENT, WALLET_CLIENT } from '../modules/viem.provider'
import { PoolStateService } from '../modules/pool-state.service'
import { TreasuryService } from '../treasury/treasury.service'
import { G_DOLLAR, CUSD, NFPM_ADDRESS, POOL_ADDRESS } from '../modules/config'

const NFPM_ABI = [
  {
    type: 'function' as const,
    name: 'positions',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [
      { type: 'uint96', name: 'nonce' },
      { type: 'address', name: 'operator' },
      { type: 'address', name: 'token0' },
      { type: 'address', name: 'token1' },
      { type: 'uint24', name: 'fee' },
      { type: 'int24', name: 'tickLower' },
      { type: 'int24', name: 'tickUpper' },
      { type: 'uint128', name: 'liquidity' },
      { type: 'uint256', name: 'feeGrowthInside0LastX128' },
      { type: 'uint256', name: 'feeGrowthInside1LastX128' },
      { type: 'uint128', name: 'tokensOwed0' },
      { type: 'uint128', name: 'tokensOwed1' },
    ],
    stateMutability: 'view' as const,
  },
]

@Processor('fee-collection')
export class FeeCollectionWorker extends WorkerHost {
  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly poolState: PoolStateService,
    private readonly treasury: TreasuryService,
  ) {
    super()
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'collect-fees':
        return this.collectFees()
      default:
        job.discard()
    }
  }

  private async collectFees(): Promise<void> {
    // 1. Get all active positions
    const ids = await this.treasury.getActivePositionIds()

    // 2. For each position, compute current G$ value and update
    for (const tokenId of ids) {
      const computedValue = await this.computePositionGValue(tokenId)
      await this.treasury.updatePositionValue(tokenId, computedValue)
    }

    // 3. Collect protocol fee on any NAV growth
    await this.treasury.collectFees()
  }

  private async computePositionGValue(tokenId: bigint): Promise<bigint> {
    // Read position data from the Uniswap V3 NFT manager
    const [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity,
      feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] =
      await this.client.readContract({
        address: NFPM_ADDRESS,
        abi: NFPM_ABI,
        functionName: 'positions',
        args: [tokenId],
      }) as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint]

    if (liquidity === 0n) {
      // Position has no active liquidity — value is just owed fees
      return tokensOwed0 + tokensOwed1
    }

    // Read pool slot0 to get current sqrtPriceX96
    const slot0 = await this.client.readContract({
      address: POOL_ADDRESS,
      abi: [
        {
          type: 'function' as const,
          name: 'slot0',
          inputs: [],
          outputs: [
            { type: 'uint160', name: 'sqrtPriceX96' },
            { type: 'int24', name: 'tick' },
            { type: 'uint16', name: 'observationIndex' },
            { type: 'uint16', name: 'observationCardinality' },
            { type: 'uint16', name: 'observationCardinalityNext' },
            { type: 'uint8', name: 'feeProtocol' },
            { type: 'bool', name: 'unlocked' },
          ],
          stateMutability: 'view' as const,
        },
      ],
      functionName: 'slot0',
    }) as [bigint, number, number, number, number, number, boolean]

    const sqrtPriceX96 = slot0[0]

    // Compute token amounts from liquidity and ticks
    // Using the standard Uniswap V3 formulas:
    // - If current tick < tickLower: all in token0
    // - If current tick > tickUpper: all in token1
    // - If in range: split between both
    const currentTick = slot0[1]
    const sqrtRatioAX96 = this.tickToSqrtRatio(tickLower)
    const sqrtRatioBX96 = this.tickToSqrtRatio(tickUpper)

    let amount0: bigint
    let amount1: bigint

    if (currentTick <= tickLower) {
      amount0 = this.getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, false)
      amount1 = 0n
    } else if (currentTick >= tickUpper) {
      amount0 = 0n
      amount1 = this.getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, false)
    } else {
      amount0 = this.getAmount0Delta(sqrtPriceX96, sqrtRatioBX96, liquidity, false)
      amount1 = this.getAmount1Delta(sqrtRatioAX96, sqrtPriceX96, liquidity, false)
    }

    // Add owed fees to the amounts
    amount0 += tokensOwed0
    amount1 += tokensOwed1

    // Determine which token is G$ and which is cUSD
    const gDollarAddr = G_DOLLAR.address.toLowerCase()
    const gIsToken0 = token0.toLowerCase() === gDollarAddr

    const gAmount = gIsToken0 ? amount0 : amount1
    const cUsdAmount = gIsToken0 ? amount1 : amount0

    // Value the cUSD portion in G$ using the pool's sqrtPriceX96
    // price = (sqrtPriceX96 / 2^96)^2 for token1/token0
    const PRICE_PRECISION = 1n << 192n
    const priceX192 = (sqrtPriceX96 * sqrtPriceX96)
    const cUsdInG = gIsToken0
      ? (cUsdAmount * priceX192) / PRICE_PRECISION  // cUSD → G$ (token1→token0)
      : (cUsdAmount * PRICE_PRECISION) / priceX192    // cUSD → G$ (token0→token1)

    return gAmount + cUsdInG
  }

  private tickToSqrtRatio(tick: number): bigint {
    // Returns sqrtPriceX96 for a given tick
    // Using the formula: sqrt(p) = 1.0001^(tick/2) * 2^96
    const ratio = tick < 0
      ? (1n << 96n) / (this.getRatioAtTick(-tick))
      : this.getRatioAtTick(tick)
    return ratio
  }

  private getRatioAtTick(tick: number): bigint {
    // Binary exponentiation of 1.0001^tick * 2^96
    // This is a simplified implementation — for production use FixedPoint96 from v3-core
    let ratio = 0x100000000000000000000000000000000n // 1 * 2^96 (Q96.96)
    let tickAbs = tick
    if (tickAbs & 0x1) ratio = (ratio * 0xfffcb933bd6fad37aa2d162d1a594001n) >> 128n
    if (tickAbs & 0x2) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n
    if (tickAbs & 0x4) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n
    if (tickAbs & 0x8) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n
    if (tickAbs & 0x10) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n
    if (tickAbs & 0x20) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n
    if (tickAbs & 0x40) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n
    if (tickAbs & 0x80) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n
    if (tickAbs & 0x100) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n
    if (tickAbs & 0x200) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n
    if (tickAbs & 0x400) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n
    if (tickAbs & 0x800) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n
    if (tickAbs & 0x1000) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n
    if (tickAbs & 0x2000) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n
    if (tickAbs & 0x4000) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n
    if (tickAbs & 0x8000) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n
    if (tickAbs & 0x10000) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n
    if (tickAbs & 0x20000) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n
    if (tickAbs & 0x40000) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n
    if (tickAbs & 0x80000) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n
    return ratio
  }

  private getAmount0Delta(sqrtRatioAX96: bigint, sqrtRatioBX96: bigint, liquidity: bigint, roundUp: boolean): bigint {
    const [lower, upper] = sqrtRatioAX96 < sqrtRatioBX96
      ? [sqrtRatioAX96, sqrtRatioBX96]
      : [sqrtRatioBX96, sqrtRatioAX96]
    const numerator = (upper - lower) * liquidity
    const denominator = upper * lower
    const result = numerator / denominator
    return roundUp ? result + 1n : result
  }

  private getAmount1Delta(sqrtRatioAX96: bigint, sqrtRatioBX96: bigint, liquidity: bigint, roundUp: boolean): bigint {
    const [lower, upper] = sqrtRatioAX96 < sqrtRatioBX96
      ? [sqrtRatioAX96, sqrtRatioBX96]
      : [sqrtRatioBX96, sqrtRatioAX96]
    const result = liquidity * (upper - lower) / (1n << 96n)
    return roundUp ? result + 1n : result
  }
}
