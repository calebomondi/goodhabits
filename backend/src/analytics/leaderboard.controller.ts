import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { LeaderboardService } from './leaderboard.service'

@Controller('analytics')
export class LeaderboardController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Get('leaderboard')
  async getLeaderboard() {
    const data = await this.leaderboardService.getLeaderboard()
    return { data }
  }

  @Get('leaderboard/status')
  async getLeaderboardStatus(@Query('user') user: string) {
    const status = await this.leaderboardService.getUserStatus(user)
    if (!status) {
      return {
        points: '0',
        tier: 'bronze',
        currentStreak: 0,
        pointsFrozenUntil: null,
        isFrozen: false,
        streakBreakCount: 0,
      }
    }
    return status
  }

  @Post('habits')
  async setHabits(
    @Body() body: { address: string; spendPct: number; savePct: number; investPct: number },
  ) {
    await this.leaderboardService.setHabitStrategy(
      body.address,
      body.spendPct,
      body.savePct,
      body.investPct,
    )
    return { success: true }
  }

  @Post('habits/save')
  async recordSave(
    @Body() body: { address: string; amount: string },
  ) {
    await this.leaderboardService.recordSave(body.address, body.amount)
    return { success: true }
  }
}
