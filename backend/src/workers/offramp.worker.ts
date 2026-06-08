import { Inject, Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { type Address, type PublicClient, type WalletClient, encodeFunctionData } from 'viem'
import { celo } from 'viem/chains'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { offrampRequests } from '../drizzle/schema/offramp-requests'
import { PUBLIC_CLIENT, WALLET_CLIENT, NonceManager } from '../modules/viem.provider'
import { SwapService } from '../modules/swap.service'
import { G_DOLLAR } from '../modules/config'

const G_TOKEN = G_DOLLAR.address as `0x${string}`

const erc20Abi = [
  {
    type: 'function' as const,
    name: 'transferFrom',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'allowance',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
]

@Processor('offramp')
export class OfframpWorker extends WorkerHost {
  private readonly logger = new Logger(OfframpWorker.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly nonceManager: NonceManager,
    private readonly swap: SwapService,
  ) {
    super()
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'fulfill':
        return this.fulfillOfframps()
      default:
        job.discard()
    }
  }

  private async fulfillOfframps(): Promise<void> {
    const pending = await this.db
      .select()
      .from(offrampRequests)
      .where(eq(offrampRequests.status, 'pending'))
      .limit(10)

    if (pending.length === 0) return

    const backendAddress = this.walletClient.account!.address as Address

    for (const req of pending) {
      try {
        await this.processRequest(req, backendAddress)
      } catch (err) {
        this.logger.error(`Offramp ${req.id} failed: ${err}`)
        await this.db
          .update(offrampRequests)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(offrampRequests.id, req.id))
      }
    }
  }

  private async processRequest(req: typeof offrampRequests.$inferSelect, backendAddress: Address): Promise<void> {
    const userAddress = req.userAddress as Address
    const amountG = BigInt(req.amountG)
    const usdcRecipient = (req.usdcRecipient ?? backendAddress) as Address

    // 1. Check user approved enough G$ allowance for backend to spend
    const allowance = await this.client.readContract({
      address: G_TOKEN,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, backendAddress],
    }) as bigint

    if (allowance < amountG) {
      this.logger.warn(`Offramp ${req.id}: insufficient allowance ${allowance} < ${amountG}, will retry`)
      return
    }

    this.logger.log(`Offramp ${req.id}: pulling ${amountG} G$ from ${userAddress}`)

    // 2. transferFrom user → backend hot wallet
    const [tfNonce] = await this.nonceManager.allocate(1)
    const tfHash = await this.walletClient.sendTransaction({
      to: G_TOKEN,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transferFrom',
        args: [userAddress, backendAddress, amountG],
      }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      nonce: tfNonce,
      chain: celo,
      account: this.walletClient.account!,
    })
    const tfReceipt = await this.client.waitForTransactionReceipt({ hash: tfHash, timeout: 180_000 })
    if (tfReceipt.status !== 'success') {
      throw new Error(`transferFrom reverted: ${tfHash}`)
    }
    this.logger.debug(`Offramp ${req.id}: transferFrom confirmed: ${tfHash}`)

    // 3. Quote multi-hop swap G$ → cUSD → USDC
    const amountOut = await this.swap.quoteMultiHop(amountG)
    this.logger.debug(`Offramp ${req.id}: quote ${amountOut} USDC for ${amountG} G$`)

    // 4. Execute swap with USDC sent directly to the recipient
    const swapHash = await this.swap.executeMultiHopSwap(amountG, amountOut, usdcRecipient, 100)
    const swapReceipt = await this.client.waitForTransactionReceipt({ hash: swapHash, timeout: 180_000 })
    if (swapReceipt.status !== 'success') {
      throw new Error(`Multi-hop swap reverted: ${swapHash}`)
    }
    this.logger.debug(`Offramp ${req.id}: swap confirmed: ${swapHash}`)

    // 5. Mark complete
    await this.db
      .update(offrampRequests)
      .set({
        status: 'completed',
        swapTxHash: swapHash,
        updatedAt: new Date(),
      })
      .where(eq(offrampRequests.id, req.id))

    this.logger.log(`Offramp ${req.id}: completed — ${amountG} G$ → USDC to ${usdcRecipient}`)
  }
}
