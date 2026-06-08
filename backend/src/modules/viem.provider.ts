import { Injectable, Inject, Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import dns from 'dns'
import { createPublicClient, createWalletClient, http, type Address, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

dns.setDefaultResultOrder('ipv4first')

export const PUBLIC_CLIENT = 'PUBLIC_CLIENT'
export const WALLET_CLIENT = 'WALLET_CLIENT'

const TRANSPORT_OPTS = { timeout: 30_000, retryCount: 3 }

@Injectable()
export class NonceManager {
  private counter: number | null = null
  private queue: Promise<void> = Promise.resolve()

  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
  ) {}

  async allocate(count: number): Promise<number[]> {
    let nonces!: number[]
    this.queue = this.queue.then(async () => {
      if (this.counter === null) {
        const address = this.walletClient.account!.address as Address
        this.counter = await this.client.getTransactionCount({ address, blockTag: 'pending' })
      }
      nonces = Array.from({ length: count }, (_, i) => this.counter! + i)
      this.counter! += count
    })
    await this.queue
    return nonces
  }

  async resync(): Promise<void> {
    const address = this.walletClient.account!.address as Address
    this.counter = await this.client.getTransactionCount({ address, blockTag: 'pending' })
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PUBLIC_CLIENT,
      useFactory: (config: ConfigService) =>
        createPublicClient({
          chain: celo,
          transport: http(config.get<string>('RPC_URL'), TRANSPORT_OPTS),
        }),
      inject: [ConfigService],
    },
    {
      provide: WALLET_CLIENT,
      useFactory: (config: ConfigService) => {
        let pk = config.get<string>('BACKEND_PRIVATE_KEY')
        if (!pk) {
          throw new Error('BACKEND_PRIVATE_KEY is missing. '
            + 'Set it in Render Dashboard → gooddollar-backend → Environment → Secret Files.')
        }
        if (!pk.startsWith('0x')) pk = `0x${pk}`
        const account = privateKeyToAccount(pk as `0x${string}`)
        return createWalletClient({
          account,
          chain: celo,
          transport: http(config.get<string>('RPC_URL'), TRANSPORT_OPTS),
        })
      },
      inject: [ConfigService],
    },
    NonceManager,
  ],
  exports: [PUBLIC_CLIENT, WALLET_CLIENT, NonceManager],
})
export class ViemModule {}
