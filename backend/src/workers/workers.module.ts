import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { UniswapModule } from '../modules/uniswap.module'
import { TreasuryModule } from '../treasury/treasury.module'
import { DrizzleModule } from '../drizzle/drizzle.module'
import { StrategyWorker } from './strategy.worker'
import { FeeCollectionWorker } from './fee-collection.worker'
import { WithdrawalWorker } from './withdrawal.worker'
import { OfframpWorker } from './offramp.worker'
import { ProducerService } from './producer.service'

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
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
export class WorkersModule {}
