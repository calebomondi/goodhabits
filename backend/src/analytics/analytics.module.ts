import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TreasuryModule } from '../treasury/treasury.module'
import { PriceModule } from '../price/price.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { SnapshotService } from './snapshot.service'
import { SnapshotWorker } from './snapshot.worker'
import { VolumeIndexerService } from './volume-indexer.service'
import { LeaderboardController } from './leaderboard.controller'
import { LeaderboardService } from './leaderboard.service'

@Module({
  imports: [
    TreasuryModule,
    PriceModule,
    BullModule.registerQueue({ name: 'snapshot' }),
  ],
  controllers: [AnalyticsController, LeaderboardController],
  providers: [
    AnalyticsService,
    SnapshotService,
    SnapshotWorker,
    VolumeIndexerService,
    LeaderboardService,
  ],
  exports: [AnalyticsService, LeaderboardService],
})
export class AnalyticsModule {}
