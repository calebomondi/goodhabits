import { Inject, Injectable } from '@nestjs/common'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { asc, desc, eq, gte, sql } from 'drizzle-orm'
import { type Address, formatUnits } from 'viem'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { treasurySnapshots } from '../drizzle/schema/treasury-snapshots'
import { dailyVolume } from '../drizzle/schema/daily-volume'
import { userTransactions } from '../drizzle/schema/user-transactions'
import { PriceService } from '../price/price.service'
import { TreasuryService } from '../treasury/treasury.service'

type Range = '7d' | '30d' | '90d'

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly priceService: PriceService,
    private readonly treasury: TreasuryService,
  ) {}

  private rangeToDate(range: Range): Date {
    const now = new Date()
    const days = { '7d': 7, '30d': 30, '90d': 90 }
    return new Date(now.getTime() - days[range] * 86400000)
  }

  async getNavHistory(range: Range) {
    const since = this.rangeToDate(range)
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${treasurySnapshots.timestamp})`,
        totalAssets: sql<string>`AVG(${treasurySnapshots.totalAssets})`,
        idleAssets: sql<string>`AVG(${treasurySnapshots.idleAssets})`,
        deployedAssets: sql<string>`AVG(${treasurySnapshots.deployedAssets})`,
        reservedAssets: sql<string>`AVG(${treasurySnapshots.reservedAssets})`,
      })
      .from(treasurySnapshots)
      .where(gte(treasurySnapshots.timestamp, since))
      .groupBy(sql`DATE(${treasurySnapshots.timestamp})`)
      .orderBy(sql`DATE(${treasurySnapshots.timestamp})`)

    return {
      data: rows.map((r) => ({
        date: r.date,
        idle: r.idleAssets,
        deployed: r.deployedAssets,
        reserved: r.reservedAssets,
      })),
    }
  }

  async getPricePerShareHistory(range: Range) {
    const since = this.rangeToDate(range)
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${treasurySnapshots.timestamp})`,
        price: sql<string>`AVG(${treasurySnapshots.pricePerShare})`,
      })
      .from(treasurySnapshots)
      .where(gte(treasurySnapshots.timestamp, since))
      .groupBy(sql`DATE(${treasurySnapshots.timestamp})`)
      .orderBy(sql`DATE(${treasurySnapshots.timestamp})`)

    return {
      data: rows.map((r) => ({
        date: r.date,
        price: r.price,
      })),
    }
  }

  async getRevenueHistory(range: Range) {
    const since = this.rangeToDate(range)
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${treasurySnapshots.timestamp})`,
        fees: sql<string>`AVG(${treasurySnapshots.accruedFees})`,
      })
      .from(treasurySnapshots)
      .where(gte(treasurySnapshots.timestamp, since))
      .groupBy(sql`DATE(${treasurySnapshots.timestamp})`)
      .orderBy(sql`DATE(${treasurySnapshots.timestamp})`)

    return {
      data: rows.map((r) => ({
        date: r.date,
        fees: r.fees,
      })),
    }
  }

  async getVolumeHistory(range: Range) {
    const since = this.rangeToDate(range)
    const rows = await this.db
      .select()
      .from(dailyVolume)
      .where(gte(dailyVolume.date, since.toISOString().slice(0, 10)))
      .orderBy(asc(dailyVolume.date))

    return {
      data: rows.map((r) => ({
        date: r.date,
        deposits: r.depositVolume,
        withdrawals: (BigInt(r.spendableWithdrawals || '0') + BigInt(r.savingsWithdrawals || '0') + BigInt(r.withdrawalFinalizedVolume || '0')).toString(),
        netFlow: (BigInt(r.depositVolume || '0') - BigInt(r.spendableWithdrawals || '0') - BigInt(r.savingsWithdrawals || '0') - BigInt(r.withdrawalFinalizedVolume || '0')).toString(),
      })),
    }
  }

  async getDailyVolumeRows(range: Range) {
    const since = this.rangeToDate(range)
    const rows = await this.db
      .select()
      .from(dailyVolume)
      .where(gte(dailyVolume.date, since.toISOString().slice(0, 10)))
      .orderBy(desc(dailyVolume.date))

    return { data: rows }
  }

  async getSummary() {
    const latest = await this.db
      .select()
      .from(treasurySnapshots)
      .orderBy(desc(treasurySnapshots.timestamp))
      .limit(1)
      .then((r) => r[0])

    const previous = await this.db
      .select()
      .from(treasurySnapshots)
      .orderBy(desc(treasurySnapshots.timestamp))
      .offset(1)
      .limit(1)
      .then((r) => r[0])

    if (!latest) {
      return {
        totalAssets: '0',
        idleAssets: '0',
        deployedAssets: '0',
        reservedAssets: '0',
        pricePerShare: '0',
        totalShares: '0',
        accruedFees: '0',
        activePositions: 0,
        totalUsers: 0,
        ppsChange24h: 0,
        assetsChange24h: 0,
        totalAssetsUsd: null,
        idleAssetsUsd: null,
        deployedAssetsUsd: null,
        reservedAssetsUsd: null,
        accruedFeesUsd: null,
      }
    }

    const ppsChange = previous && Number(previous.pricePerShare) > 0
      ? ((Number(latest.pricePerShare) - Number(previous.pricePerShare)) / Number(previous.pricePerShare)) * 100
      : 0

    const assetsChange = previous && Number(previous.totalAssets) > 0
      ? ((Number(latest.totalAssets) - Number(previous.totalAssets)) / Number(previous.totalAssets)) * 100
      : 0

    const price = await this.priceService.getG$PriceUsd()

    const toUsd = (wei: string): string | null => {
      if (price === null) return null
      const g$ = Number(formatUnits(BigInt(wei || '0'), 18))
      return (g$ * price).toFixed(2)
    }

    return {
      totalAssets: latest.totalAssets,
      idleAssets: latest.idleAssets,
      deployedAssets: latest.deployedAssets,
      reservedAssets: latest.reservedAssets,
      pricePerShare: latest.pricePerShare,
      totalShares: latest.totalShares,
      accruedFees: latest.accruedFees,
      activePositions: latest.activePositions,
      totalUsers: 0,
      ppsChange24h: Math.round(ppsChange * 100) / 100,
      assetsChange24h: Math.round(assetsChange * 100) / 100,
      totalAssetsUsd: toUsd(latest.totalAssets),
      idleAssetsUsd: toUsd(latest.idleAssets),
      deployedAssetsUsd: toUsd(latest.deployedAssets),
      reservedAssetsUsd: toUsd(latest.reservedAssets),
      accruedFeesUsd: toUsd(latest.accruedFees),
    }
  }

  async getSummaryLive() {
    const [totalAssets, idleAssets, deployedAssets, reservedAssets, accruedFees] = await Promise.all([
      this.treasury.calculateTotalAssets(),
      this.treasury.assetsToInvest(),
      this.treasury.deployedAssets(),
      this.treasury.reservedAssets(),
      this.treasury.accruedFees(),
    ])

    const totalAssetsStr = totalAssets.toString()
    const idleAssetsStr = idleAssets.toString()
    const deployedAssetsStr = deployedAssets.toString()
    const reservedAssetsStr = reservedAssets.toString()
    const accruedFeesStr = accruedFees.toString()

    const price = await this.priceService.getG$PriceUsd()

    const toUsd = (wei: string): string | null => {
      if (price === null) return null
      const g$ = Number(formatUnits(BigInt(wei || '0'), 18))
      return (g$ * price).toFixed(2)
    }

    return {
      totalAssets: totalAssetsStr,
      idleAssets: idleAssetsStr,
      deployedAssets: deployedAssetsStr,
      reservedAssets: reservedAssetsStr,
      pricePerShare: '0',
      totalShares: '0',
      accruedFees: accruedFeesStr,
      activePositions: 0,
      totalUsers: 0,
      ppsChange24h: 0,
      assetsChange24h: 0,
      totalAssetsUsd: toUsd(totalAssetsStr),
      idleAssetsUsd: toUsd(idleAssetsStr),
      deployedAssetsUsd: toUsd(deployedAssetsStr),
      reservedAssetsUsd: toUsd(reservedAssetsStr),
      accruedFeesUsd: toUsd(accruedFeesStr),
    }
  }

  async getUserAllocation(user: Address) {
    const alloc = await this.treasury.getUserAllocation(user)
    const allocData = alloc as { spendAmount: bigint; saveAmount: bigint; investAmount: bigint }

    const spendAmount = allocData.spendAmount.toString()
    const saveAmount = allocData.saveAmount.toString()
    const investAmount = allocData.investAmount.toString()

    const price = await this.priceService.getG$PriceUsd()

    const toUsd = (wei: string): string | null => {
      if (price === null) return null
      const g$ = Number(formatUnits(BigInt(wei || '0'), 18))
      return (g$ * price).toFixed(2)
    }

    return {
      spendAmount,
      saveAmount,
      investAmount,
      totalAssets: (allocData.spendAmount + allocData.saveAmount + allocData.investAmount).toString(),
      spendAmountUsd: toUsd(spendAmount),
      saveAmountUsd: toUsd(saveAmount),
      investAmountUsd: toUsd(investAmount),
      totalAssetsUsd: toUsd((allocData.spendAmount + allocData.saveAmount + allocData.investAmount).toString()),
    }
  }

  async getUserTransactions(user: `0x${string}`) {
    const rows = await this.db
      .select()
      .from(userTransactions)
      .where(eq(userTransactions.userAddress, user.toLowerCase()))
      .orderBy(desc(userTransactions.createdAt))
      .limit(100)

    return rows
  }
}
