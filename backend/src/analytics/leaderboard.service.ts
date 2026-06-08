import { Inject, Injectable } from '@nestjs/common'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { desc, eq, sql } from 'drizzle-orm'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { userHabits } from '../drizzle/schema/user-habits'

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export type LeaderboardEntry = {
  rank: number
  address: string
  points: number
  tier: Tier
  currentStreak: number
  longestStreak: number
  totalSaved: string
  consistency: number
  pointsFrozenUntil: string | null
}

export type LeaderboardStatus = {
  points: string
  tier: Tier
  currentStreak: number
  pointsFrozenUntil: string | null
  isFrozen: boolean
  streakBreakCount: number
}

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  computePoints(
    currentStreak: number,
    totalSavedWei: string,
    consistency: string,
  ): number {
    let streakMultiplier = 10
    if (currentStreak >= 8) streakMultiplier = 20
    if (currentStreak >= 31) streakMultiplier = 30
    const streakPoints = currentStreak * streakMultiplier

    const savedG$ = Math.min(Number(totalSavedWei) / 1e18, 10000)
    const amountPoints = savedG$

    const consistencyBonus = Number(consistency) * 50

    return Math.round(streakPoints + amountPoints + consistencyBonus)
  }

  computeTier(points: number): Tier {
    if (points >= 10_000) return 'diamond'
    if (points >= 5_000) return 'platinum'
    if (points >= 2_000) return 'gold'
    if (points >= 500) return 'silver'
    return 'bronze'
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const rows = await this.db
      .select()
      .from(userHabits)
      .orderBy(desc(userHabits.points))
      .limit(100)

    return rows.map((r, i) => {
      const points = Number(r.points)
      return {
        rank: i + 1,
        address: r.address,
        points,
        tier: this.computeTier(points),
        currentStreak: r.currentStreak,
        longestStreak: r.longestStreak,
        totalSaved: r.totalSaved,
        consistency: Number(r.habitConsistency),
        pointsFrozenUntil: r.pointsFrozenUntil?.toISOString() ?? null,
      }
    })
  }

  async getUserStatus(address: string): Promise<LeaderboardStatus | null> {
    const row = await this.db
      .select()
      .from(userHabits)
      .where(eq(userHabits.address, address))
      .limit(1)
      .then((r) => r[0])

    if (!row) return null

    const points = Number(row.points)
    const frozenUntil = row.pointsFrozenUntil
    const isFrozen = frozenUntil ? new Date(frozenUntil) > new Date() : false

    return {
      points: row.points,
      tier: this.computeTier(points),
      currentStreak: row.currentStreak,
      pointsFrozenUntil: frozenUntil?.toISOString() ?? null,
      isFrozen,
      streakBreakCount: row.streakBreakCount,
    }
  }

  async setHabitStrategy(
    address: string,
    spendPct: number,
    savePct: number,
    investPct: number,
  ) {
    await this.db.insert(userHabits).values({
      address,
      habitSpendPct: spendPct,
      habitSavePct: savePct,
      habitInvestPct: investPct,
      habitConsistency: '0',
      totalSaved: '0',
      points: '0',
    }).onConflictDoUpdate({
      target: userHabits.address,
      set: {
        habitSpendPct: spendPct,
        habitSavePct: savePct,
        habitInvestPct: investPct,
        updatedAt: new Date(),
      },
    })
  }

  async recordSave(address: string, amountWei: string, eventDate?: string) {
    const existing = await this.db
      .select()
      .from(userHabits)
      .where(eq(userHabits.address, address))
      .limit(1)
      .then((r) => r[0])

    const today = eventDate ?? new Date().toISOString().slice(0, 10)
    const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10)

    const frozenUntil = existing?.pointsFrozenUntil
    const isFrozen = frozenUntil ? new Date(frozenUntil) > new Date(today) : false

    let currentStreak = existing?.currentStreak ?? 0
    let longestStreak = existing?.longestStreak ?? 0
    let streakBreakCount = existing?.streakBreakCount ?? 0
    let lastSaveDate = existing?.lastSaveDate
    let totalSaved = BigInt(existing?.totalSaved ?? '0') + BigInt(amountWei)
    let streakStart = existing?.streakStart

    if (isFrozen) {
      currentStreak = 0
    } else if (!lastSaveDate || lastSaveDate < yesterday) {
      currentStreak = 1
      streakStart = new Date()
    } else if (lastSaveDate === yesterday) {
      currentStreak += 1
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak
      }
    }

    const daysSinceStart = streakStart
      ? Math.ceil((Date.now() - new Date(streakStart).getTime()) / 86400000)
      : currentStreak
    const consistency = daysSinceStart > 0 ? currentStreak / daysSinceStart : 1

    let points: number
    const freezeJustEnded = existing?.pointsFrozenUntil && !isFrozen
    const useBonus = freezeJustEnded && !existing?.recoveryBonusUsed && currentStreak >= 1

    if (isFrozen) {
      points = Number(existing?.points ?? 0)
    } else if (useBonus) {
      const basePoints = this.computePoints(currentStreak, totalSaved.toString(), consistency.toString())
      points = basePoints * 2
    } else {
      points = this.computePoints(currentStreak, totalSaved.toString(), consistency.toString())
    }

    await this.db.insert(userHabits).values({
      address,
      totalSaved: totalSaved.toString(),
      currentStreak,
      longestStreak,
      streakStart,
      lastSaveDate: today,
      streakBreakCount,
      points: points.toString(),
      habitConsistency: consistency.toString(),
    }).onConflictDoUpdate({
      target: userHabits.address,
      set: {
        totalSaved: totalSaved.toString(),
        currentStreak,
        longestStreak,
        streakStart,
        lastSaveDate: today,
        streakBreakCount,
        points: points.toString(),
        habitConsistency: consistency.toString(),
        pointsFrozenUntil: isFrozen ? frozenUntil : null,
        recoveryBonusUsed: useBonus ? true : existing?.recoveryBonusUsed ?? false,
        updatedAt: new Date(),
      },
    })
  }

  async recordStreakBreak(address: string) {
    const frozenUntil = new Date(Date.now() + 7 * 86400000)
    await this.db.update(userHabits)
      .set({
        currentStreak: 0,
        streakBreakCount: sql`COALESCE(${userHabits.streakBreakCount}, 0) + 1`,
        pointsFrozenUntil: frozenUntil,
        recoveryBonusUsed: false,
        updatedAt: new Date(),
      })
      .where(eq(userHabits.address, address))
  }
}
