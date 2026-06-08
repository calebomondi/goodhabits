import { Inject } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { type WalletClient } from 'viem'
import { WALLET_CLIENT } from '../modules/viem.provider'
import { PoolStateService } from '../modules/pool-state.service'
import { SwapService } from '../modules/swap.service'
import { PositionService } from '../modules/position.service'
import { TreasuryService } from '../treasury/treasury.service'
import { CUSD, G_DOLLAR } from '../modules/config'

@Processor('withdrawal')
export class WithdrawalWorker extends WorkerHost {
  constructor(
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly poolState: PoolStateService,
    private readonly swap: SwapService,
    private readonly position: PositionService,
    private readonly treasury: TreasuryService,
  ) {
    super()
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'fulfill':
        return this.fulfillWithdrawals()
      default:
        job.discard()
    }
  }

  private async fulfillWithdrawals(): Promise<void> {
    const [account] = await this.walletClient.getAddresses()

    // 1. Check if there's enough idle to cover reserved withdrawals
    const idle = await this.treasury.assetsToInvest()
    const reserved = await this.treasury.reservedAssets()

    if (reserved <= idle) {
      // Enough liquidity — nothing to do
      return
    }

    const shortfall = reserved - idle

    // 2. Close positions until the shortfall is covered
    const activeIds = await this.treasury.getActivePositionIds()
    let totalRecovered = 0n

    for (const tokenId of activeIds) {
      if (totalRecovered >= shortfall) break

      // Collect fees before closing
      await this.position.collectFees(Number(tokenId))

      // Read the position's current value
      const pos = await this.treasury.getPosition(tokenId)
      const positionValue = (pos as { value: bigint }).value

      // Swap cUSD → G$ for the cUSD portion of the position
      // For simplicity we swap all of the value — after collecting fees
      // and burning we'll have both G$ and cUSD
      // Fetch pool state for the swap quote
      const pool = await this.poolState.fetchPoolState()
      const cUsdQuote = await this.swap.quoteSwap(CUSD, (positionValue / 2n).toString())

      // Execute swap cUSD → G$ (reverse direction)
      await this.swap.executeSwap(CUSD, (positionValue / 2n).toString(), cUsdQuote, 100)

      // Return G$ to the treasury
      await this.treasury.receiveFromStrategy(positionValue)

      // Close the position in the registry
      await this.treasury.closePosition(tokenId, positionValue)

      totalRecovered += positionValue
    }
  }
}
