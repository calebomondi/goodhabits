import { Inject, Injectable, Logger } from '@nestjs/common'
import { Position, NonfungiblePositionManager, Pool } from '@uniswap/v3-sdk'
import { Percent, CurrencyAmount } from '@uniswap/sdk-core'
import { type Address, type PublicClient, type WalletClient, parseUnits, encodeFunctionData } from 'viem'
import { celo } from 'viem/chains'
import { G_DOLLAR, CUSD, NFPM_ADDRESS, POOL_TICK_SPACING } from './config'
import { PUBLIC_CLIENT, WALLET_CLIENT, NonceManager } from './viem.provider'

const approveAbi = [
  {
    type: 'function' as const, name: 'approve',
    inputs: [{ type: 'address' as const, name: 'spender' }, { type: 'uint256' as const, name: 'amount' }],
    outputs: [{ type: 'bool' as const }],
    stateMutability: 'nonpayable' as const,
  },
]

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name)

  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly nonceManager: NonceManager,
  ) {}

  private async approveToken(tokenAddress: Address, amount: bigint, nonce: number): Promise<void> {
    const hash = await this.walletClient.sendTransaction({
      to: tokenAddress,
      data: encodeFunctionData({ abi: approveAbi, functionName: 'approve', args: [NFPM_ADDRESS as Address, amount] }),
      value: 0n, gas: 100_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce, chain: celo, account: this.walletClient.account!,
    })
    await this.client.waitForTransactionReceipt({ hash, timeout: 180_000 })
    this.logger.debug(`Approve confirmed for ${tokenAddress}: ${hash}`)
  }

  async mintPosition(
    pool: Pool,
    amount0: string,
    amount1: string,
    tickLower: number,
    tickUpper: number,
  ): Promise<`0x${string}`> {
    const myAddress = this.walletClient.account!.address as Address

    const position = Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: parseUnits(amount0, pool.token0.decimals).toString(),
      amount1: parseUnits(amount1, pool.token1.decimals).toString(),
      useFullPrecision: true,
    })

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
      recipient: myAddress,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
      slippageTolerance: new Percent(50, 10_000),
    })

    const [nonce0, nonce1, mintNonce] = await this.nonceManager.allocate(3)

    await this.approveToken(pool.token0.address as Address, BigInt(position.amount0.quotient.toString()), nonce0)
    await this.approveToken(pool.token1.address as Address, BigInt(position.amount1.quotient.toString()), nonce1)

    return this.walletClient.sendTransaction({
      to: NFPM_ADDRESS as Address,
      data: calldata as `0x${string}`,
      value: BigInt(value),
      gas: 500_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce: mintNonce, chain: celo, account: this.walletClient.account!,
    })
  }

  async increaseLiquidity(
    pool: Pool,
    tokenId: bigint,
    amount0: string,
    amount1: string,
    tickLower: number,
    tickUpper: number,
  ): Promise<`0x${string}`> {
    const myAddress = this.walletClient.account!.address as Address

    const position = Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: parseUnits(amount0, pool.token0.decimals).toString(),
      amount1: parseUnits(amount1, pool.token1.decimals).toString(),
      useFullPrecision: true,
    })

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
      tokenId: tokenId.toString(),
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
      slippageTolerance: new Percent(50, 10_000),
    })

    const [nonce0, nonce1, increaseNonce] = await this.nonceManager.allocate(3)

    await this.approveToken(pool.token0.address as Address, BigInt(position.amount0.quotient.toString()), nonce0)
    await this.approveToken(pool.token1.address as Address, BigInt(position.amount1.quotient.toString()), nonce1)

    return this.walletClient.sendTransaction({
      to: NFPM_ADDRESS as Address,
      data: calldata as `0x${string}`,
      value: BigInt(value),
      gas: 400_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce: increaseNonce, chain: celo, account: this.walletClient.account!,
    })
  }

  async collectFees(tokenId: number): Promise<`0x${string}`> {
    const myAddress = this.walletClient.account!.address as Address

    const { calldata, value } = NonfungiblePositionManager.collectCallParameters({
      tokenId: tokenId.toString(),
      expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(G_DOLLAR, 0),
      expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(CUSD, 0),
      recipient: myAddress,
    })

    const [nonce] = await this.nonceManager.allocate(1)

    return this.walletClient.sendTransaction({
      to: NFPM_ADDRESS as Address, data: calldata as `0x${string}`,
      value: BigInt(value), gas: 500_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce, chain: celo, account: this.walletClient.account!,
    })
  }
}
