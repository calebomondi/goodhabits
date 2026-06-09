import { Controller, Get, Query, Post } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'
import { SnapshotService } from './snapshot.service'

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly snapshot: SnapshotService,
  ) {}

  @Get('nav')
  nav(@Query('range') range: '7d' | '30d' | '90d' = '90d') {
    return this.analytics.getNavHistory(range)
  }

  @Get('price-per-share')
  pricePerShare(@Query('range') range: '7d' | '30d' | '90d' = '90d') {
    return this.analytics.getPricePerShareHistory(range)
  }

  @Get('revenue')
  revenue(@Query('range') range: '7d' | '30d' | '90d' = '90d') {
    return this.analytics.getRevenueHistory(range)
  }

  @Get('volume')
  volume(
    @Query('range') range: '7d' | '30d' | '90d' = '90d',
    @Query('user') user?: string,
  ) {
    if (user) return this.analytics.getUserVolumeHistory(user as `0x${string}`, range)
    return this.analytics.getVolumeHistory(range)
  }

  @Get('snapshots')
  snapshots(@Query('range') range: '7d' | '30d' | '90d' = '90d') {
    return this.analytics.getDailyVolumeRows(range)
  }

  @Get('summary')
  summary() {
    return this.analytics.getSummary()
  }

  @Get('summary/live')
  summaryLive() {
    return this.analytics.getSummaryLive()
  }

  @Get('user-alloc')
  userAllocation(@Query('user') user: string) {
    return this.analytics.getUserAllocation(user as `0x${string}`)
  }

  @Get('user-txns')
  userTransactions(@Query('user') user: string) {
    return this.analytics.getUserTransactions(user as `0x${string}`)
  }

  @Post('snapshot')
  async triggerSnapshot() {
    await this.snapshot.takeSnapshot()
    return { success: true }
  }

  @Post('refresh')
  async refresh(@Query('user') user: string, @Query('txHash') txHash?: string) {
    await this.snapshot.refreshUser(user as `0x${string}`, txHash as `0x${string}`)
    return { success: true }
  }
}
