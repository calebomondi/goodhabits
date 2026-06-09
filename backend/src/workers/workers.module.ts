import { Module, OnApplicationShutdown } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import Redis from 'ioredis'
import { UniswapModule } from '../modules/uniswap.module'
import { TreasuryModule } from '../treasury/treasury.module'
import { DrizzleModule } from '../drizzle/drizzle.module'
import { StrategyWorker } from './strategy.worker'
import { FeeCollectionWorker } from './fee-collection.worker'
import { WithdrawalWorker } from './withdrawal.worker'
import { OfframpWorker } from './offramp.worker'
import { ProducerService } from './producer.service'

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const redis = new Redis(url, {
    connectTimeout: 10_000,
    retryStrategy: (times: number) => {
      if (times > 20) return null
      return Math.min(times * 200, 5000)
    },
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: true,
    keepAlive: 1000,
  })
  redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message)
  })
  redis.on('connect', () => {
    console.log('[Redis] Connected')
  })
  return redis
}

const redisConnection = createRedisConnection()

@Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnection as any,
    }),
    BullModule.registerQueue(
      { name: 'strategy' },
      { name: 'fee-collection' },
      { name: 'withdrawal' },
      { name: 'snapshot' },
      { name: 'offramp' },
    ),
    UniswapModule,
    TreasuryModule,
    DrizzleModule,
  ],
  providers: [
    StrategyWorker,
    FeeCollectionWorker,
    WithdrawalWorker,
    OfframpWorker,
    ProducerService,
  ],
})
export class WorkersModule implements OnApplicationShutdown {
  onApplicationShutdown() {
    redisConnection.disconnect()
  }
}
