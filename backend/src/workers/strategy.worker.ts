import { Inject, Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { type PublicClient, type WalletClient, formatUnits, parseUnits } from 'viem'
import { PUBLIC_CLIENT, WALLET_CLIENT, NonceManager } from '../modules/viem.provider'
import { PoolStateService } from '../modules/pool-state.service'
import { SwapService } from '../modules/swap.service'
import { PositionService } from '../modules/position.service'
import { PositionRegistryService } from '../modules/position-registry.service'
import { TreasuryService } from '../treasury/treasury.service'
import { G_DOLLAR, CUSD, NFPM_ADDRESS, POOL_TICK_SPACING } from '../modules/config'

const TRANSFER_EVENT     = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO_ADDRESS_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000'

const balanceOfAbi = [{ type: 'function' as const, name: 'balanceOf', inputs: [{ type: 'address' as const, name: 'owner' }], outputs: [{ type: 'uint256' as const }], stateMutability: 'view' as const }]

@Processor('strategy')
export class StrategyWorker extends WorkerHost {
  private readonly MIN_DEPLOY   = parseUnits('10', G_DOLLAR.decimals)
  private readonly DEPLOY_RATIO = 5000n // 50% of idle
  private readonly HALF_RATIO   = 5000n // 50% of deploy → swap, 50% → keep as G$
  private readonly TICK_RANGE   = 10    // ±10 tick spacings around current tick
  private readonly logger       = new Logger(StrategyWorker.name)

  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly poolState: PoolStateService,
    private readonly swap: SwapService,
    private readonly position: PositionService,
    private readonly positionRegistry: PositionRegistryService,
    private readonly treasury: TreasuryService,
    private readonly nonceManager: NonceManager,
  ) {
    super()
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'deploy-and-lp': return this.deployAndLp()
      default: job.discard()
    }
  }

  private async deployAndLp(): Promise<void> {
    const account = this.walletClient.account!.address

    // 1. Pool state
    let pool = await this.poolState.fetchPoolState()
    this.logger.log(`Pool tick: ${pool.tickCurrent}`)

    // 2. Tick range
    const tickLower = Math.floor(pool.tickCurrent / POOL_TICK_SPACING - this.TICK_RANGE) * POOL_TICK_SPACING
    const tickUpper = Math.ceil(pool.tickCurrent  / POOL_TICK_SPACING + this.TICK_RANGE) * POOL_TICK_SPACING
    this.logger.log(`Tick range: [${tickLower}, ${tickUpper}]`)

    // 3. Check for existing in-range position
    const existingTokenId = await this.positionRegistry.findActivePositionInTickRange(tickLower, tickUpper)
    const isInRange = pool.tickCurrent >= tickLower && pool.tickCurrent <= tickUpper

    // 4. Treasury deploy + swap if enough idle G$
    const idle     = await this.treasury.assetsToInvest()
    const reserved = await this.treasury.reservedAssets()
    const available = idle > reserved ? idle - reserved : 0n

    let deployAmount = 0n
    if (available >= this.MIN_DEPLOY) {
      deployAmount = (available * this.DEPLOY_RATIO) / 10000n
      const halfAmount   = (deployAmount * this.HALF_RATIO) / 10000n
      this.logger.log(`Deploy: ${formatUnits(deployAmount, G_DOLLAR.decimals)} G$ (swap half: ${formatUnits(halfAmount, G_DOLLAR.decimals)})`)

      const halfFormatted = formatUnits(halfAmount, G_DOLLAR.decimals)
      const cUsdQuote     = await this.swap.quoteSwap(G_DOLLAR, halfFormatted)
      this.logger.log(`Swap quote: ${halfFormatted} G$ → ${formatUnits(cUsdQuote, CUSD.decimals)} cUSD`)

      const [deployNonce] = await this.nonceManager.allocate(1)
      await this.treasury.deployToStrategy(account, deployAmount, deployNonce)
      this.logger.log('Deploy done')

      const swapTx = await this.swap.executeSwap(G_DOLLAR, halfFormatted, cUsdQuote)
      await this.client.waitForTransactionReceipt({ hash: swapTx, timeout: 180_000 })
      this.logger.log(`Swap confirmed: ${swapTx}`)

      pool = await this.poolState.fetchPoolState()
      this.logger.log(`Post-swap pool tick: ${pool.tickCurrent}`)
    } else {
      this.logger.log(`Skipping deploy: ${formatUnits(available, G_DOLLAR.decimals)} G$ < ${formatUnits(this.MIN_DEPLOY, G_DOLLAR.decimals)} G$`)
    }

    // 5. Read actual account balances for mint
    const accountAddr = account as `0x${string}`
    const [actualG$, actualCUsd] = await Promise.all([
      this.client.readContract({ address: G_DOLLAR.address as `0x${string}`, abi: balanceOfAbi, functionName: 'balanceOf', args: [accountAddr] }) as Promise<bigint>,
      this.client.readContract({ address: CUSD.address as `0x${string}`, abi: balanceOfAbi, functionName: 'balanceOf', args: [accountAddr] }) as Promise<bigint>,
    ])
    const actualG$Formatted   = formatUnits(actualG$, G_DOLLAR.decimals)
    const actualCUsdFormatted = formatUnits(actualCUsd, CUSD.decimals)
    this.logger.log(`Account balances: ${actualG$Formatted} G$, ${actualCUsdFormatted} cUSD`)

    if (actualG$ < this.MIN_DEPLOY && actualCUsd < this.MIN_DEPLOY) {
      this.logger.log('Account balances too low, skipping')
      return
    }

    const isGDollarToken0 = pool.token0.address.toLowerCase() === G_DOLLAR.address.toLowerCase()
    const amount0 = isGDollarToken0 ? actualG$Formatted : actualCUsdFormatted
    const amount1 = isGDollarToken0 ? actualCUsdFormatted : actualG$Formatted

    // 6. Mint or increase
    if (existingTokenId !== null && isInRange) {
      this.logger.log(`Increasing liquidity tokenId=${existingTokenId}`)
      const increaseTx = await this.position.increaseLiquidity(pool, existingTokenId, amount0, amount1, tickLower, tickUpper)
      await this.client.waitForTransactionReceipt({ hash: increaseTx, timeout: 180_000 })
      this.logger.log(`IncreaseLiquidity confirmed: ${increaseTx}`)
    } else {
      this.logger.log('Minting new position...')
      const mintTx = await this.position.mintPosition(pool, amount0, amount1, tickLower, tickUpper)
      const receipt = await this.client.waitForTransactionReceipt({ hash: mintTx, timeout: 180_000 })
      if (receipt.status === 'reverted') {
        this.logger.error(`Mint reverted! Logs: ${JSON.stringify(receipt.logs)}`)
        throw new Error('Mint transaction reverted')
      }

      const mintLog = receipt.logs.find(
        l => l.address.toLowerCase() === NFPM_ADDRESS.toLowerCase()
          && l.topics[0] === TRANSFER_EVENT
          && l.topics[1] === ZERO_ADDRESS_TOPIC,
      )
      if (!mintLog?.topics[3]) throw new Error('Mint Transfer event not found in logs')
      const tokenId = BigInt(mintLog.topics[3])
      this.logger.log(`Minted tokenId=${tokenId}`)

      const posValue = deployAmount || actualG$
      await this.treasury.registerPosition(tokenId, posValue)
      await this.positionRegistry.registerPosition(tokenId, tickLower, tickUpper)
      this.logger.log('Position registered')
    }
  }
}
