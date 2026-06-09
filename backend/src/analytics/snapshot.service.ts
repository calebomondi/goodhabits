import { Inject, Injectable } from '@nestjs/common'
import { type PublicClient, type WalletClient } from 'viem'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { PUBLIC_CLIENT, WALLET_CLIENT } from '../modules/viem.provider'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { TreasuryService } from '../treasury/treasury.service'
import { treasurySnapshots } from '../drizzle/schema/treasury-snapshots'
import { positionSnapshots } from '../drizzle/schema/position-snapshots'
import { userStatsSnapshots } from '../drizzle/schema/user-stats-snapshots'
import { userHabits } from '../drizzle/schema/user-habits'
import { VolumeIndexerService } from './volume-indexer.service'
import { LeaderboardService } from './leaderboard.service'
import { NFPM_ADDRESS, POOL_ADDRESS, G_DOLLAR } from '../modules/config'

const NFPM_POSITIONS_ABI = [
  {
    type: 'function' as const,
    name: 'positions',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [
      { type: 'uint96', name: 'nonce' },
      { type: 'address', name: 'operator' },
      { type: 'address', name: 'token0' },
      { type: 'address', name: 'token1' },
      { type: 'uint24', name: 'fee' },
      { type: 'int24', name: 'tickLower' },
      { type: 'int24', name: 'tickUpper' },
      { type: 'uint128', name: 'liquidity' },
      { type: 'uint256', name: 'feeGrowthInside0LastX128' },
      { type: 'uint256', name: 'feeGrowthInside1LastX128' },
      { type: 'uint128', name: 'tokensOwed0' },
      { type: 'uint128', name: 'tokensOwed1' },
    ],
    stateMutability: 'view' as const,
  },
]

const SLOT0_ABI = [
  {
    type: 'function' as const,
    name: 'slot0',
    inputs: [],
    outputs: [
      { type: 'uint160', name: 'sqrtPriceX96' },
      { type: 'int24', name: 'tick' },
      { type: 'uint16', name: 'observationIndex' },
      { type: 'uint16', name: 'observationCardinality' },
      { type: 'uint16', name: 'observationCardinalityNext' },
      { type: 'uint8', name: 'feeProtocol' },
      { type: 'bool', name: 'unlocked' },
    ],
    stateMutability: 'view' as const,
  },
]

@Injectable()
export class SnapshotService {
  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly treasury: TreasuryService,
    private readonly volumeIndexer: VolumeIndexerService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  async takeSnapshot(): Promise<void> {
    const blockNumber = await this.client.getBlockNumber()

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const _read = async <T>(fn: () => Promise<T>): Promise<T> => {
      await delay(100)
      return fn()
    }

    const [
      totalAssets,
      idleAssets,
      deployedAssets,
      reservedAssets,
      totalShares,
      pricePerShare,
      accruedFees,
      activePositionIds,
    ] = await Promise.all([
      _read(() => this.treasury.calculateTotalAssets()),
      _read(() => this.treasury.assetsToInvest()),
      _read(() => this.treasury.deployedAssets()),
      _read(() => this.treasury.reservedAssets()),
      _read(() => this.treasury.totalShares()),
      _read(() => this.treasury.pricePerShare()),
      _read(() => this.treasury.accruedFees()),
      _read(() => this.treasury.getActivePositionIds()),
    ])

    const reserved = reservedAssets
    const idle = idleAssets > reserved ? idleAssets - reserved : 0n

    let positionValue = 0n
    const positionPromises = activePositionIds.map(async (tokenId) => {
      const pos = await this.treasury.getPosition(tokenId)
      const posData = pos as { value: bigint; tokenId: bigint }
      positionValue += posData.value
      return posData
    })
    const positions = await Promise.all(positionPromises)

    const now = new Date()

    await this.db.insert(treasurySnapshots).values({
      totalAssets: totalAssets.toString(),
      idleAssets: idle.toString(),
      deployedAssets: deployedAssets.toString(),
      reservedAssets: reservedAssets.toString(),
      positionValue: positionValue.toString(),
      totalShares: totalShares.toString(),
      pricePerShare: pricePerShare.toString(),
      accruedFees: accruedFees.toString(),
      activePositions: activePositionIds.length,
      blockNumber: blockNumber,
      timestamp: now,
    })

    if (positions.length > 0) {
      const slot0 = await this.client.readContract({
        address: POOL_ADDRESS,
        abi: SLOT0_ABI,
        functionName: 'slot0',
      }) as [bigint, number, number, number, number, number, boolean]

      const currentTick = slot0[1]
      const gDollarAddr = G_DOLLAR.address.toLowerCase()

      const positionSnapshotData = await Promise.all(
        activePositionIds.map(async (tokenId, i) => {
          const raw = await this.client.readContract({
            address: NFPM_ADDRESS,
            abi: NFPM_POSITIONS_ABI,
            functionName: 'positions',
            args: [tokenId],
          }) as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint]

          const [, , token0, , , tickLower, tickUpper, liquidity, , , tokensOwed0, tokensOwed1] = raw
          const gIsToken0 = token0.toLowerCase() === gDollarAddr
          const gAmount = gIsToken0 ? tokensOwed0 : tokensOwed1
          const cusdAmount = gIsToken0 ? tokensOwed1 : tokensOwed0
          const inRange = currentTick >= tickLower && currentTick <= tickUpper

          return {
            tokenId: tokenId,
            value: positions[i].value.toString(),
            gAmount: gAmount.toString(),
            cusdAmount: cusdAmount.toString(),
            feesOwedG: gAmount.toString(),
            feesOwedCusd: cusdAmount.toString(),
            liquidity: liquidity.toString(),
            tickLower,
            tickUpper,
            currentTick,
            inRange,
            blockNumber: blockNumber,
            timestamp: now,
          }
        }),
      )

      for (const data of positionSnapshotData) {
        await this.db.insert(positionSnapshots).values(data)
      }
    }

    await this.db.insert(userStatsSnapshots).values({
      totalUsers: 0,
      usersWithShares: 0,
      usersWithHabitSet: 0,
      avgShareBalance: '0',
      totalLifetimeDeposits: '0',
      totalLifetimeWithdrawals: '0',
      activeWithdrawalRequests: 0,
      pendingWithdrawalValue: '0',
      blockNumber: blockNumber,
      timestamp: now,
    })

    await this.volumeIndexer.indexEvents(blockNumber)

    const trackedUsers = await this.db
      .select({ address: userHabits.address })
      .from(userHabits)

    for (const { address } of trackedUsers) {
      const alloc = await this.treasury.getUserAllocation(address as `0x${string}`) as { spendAmount: bigint; saveAmount: bigint; investAmount: bigint }
      const saveAmount = alloc.saveAmount
      const existing = await this.db
        .select()
        .from(userHabits)
        .where(eq(userHabits.address, address))
        .then((r) => r[0])
      if (!existing) continue

      const frozenUntil = existing.pointsFrozenUntil
      const isFrozen = frozenUntil ? new Date(frozenUntil) > new Date() : false

      let points: number
      if (isFrozen) {
        points = Number(existing.points)
      } else {
        const currentStreak = existing.currentStreak
        const consistency = existing.habitConsistency
        points = this.leaderboardService.computePoints(currentStreak, saveAmount.toString(), consistency)
      }

      await this.db
        .update(userHabits)
        .set({
          totalSaved: saveAmount.toString(),
          points: points.toString(),
          pointsFrozenUntil: isFrozen ? frozenUntil : null,
          updatedAt: new Date(),
        })
        .where(eq(userHabits.address, address))

      await delay(100)
    }
  }

  async refreshUser(user: `0x${string}`, txHash?: `0x${string}`): Promise<void> {
    if (txHash) {
      await this.volumeIndexer.indexUserEventByTxHash(user, txHash)
    }

    const blockNumber = await this.client.getBlockNumber()
    await this.volumeIndexer.indexUserEvents(user, blockNumber)
    await this.volumeIndexer.indexEvents(blockNumber)

    const alloc = await this.treasury.getUserAllocation(user) as { spendAmount: bigint; saveAmount: bigint; investAmount: bigint }
    const saveAmount = alloc.saveAmount
    const existing = await this.db
      .select()
      .from(userHabits)
      .where(eq(userHabits.address, user))
      .then((r) => r[0])
    if (!existing) return

    const frozenUntil = existing.pointsFrozenUntil
    const isFrozen = frozenUntil ? new Date(frozenUntil) > new Date() : false

    let points: number
    if (isFrozen) {
      points = Number(existing.points)
    } else {
      const currentStreak = existing.currentStreak
      const consistency = existing.habitConsistency
      points = this.leaderboardService.computePoints(currentStreak, saveAmount.toString(), consistency)
    }

    await this.db
      .update(userHabits)
      .set({
        totalSaved: saveAmount.toString(),
        points: points.toString(),
        pointsFrozenUntil: isFrozen ? frozenUntil : null,
        updatedAt: new Date(),
      })
      .where(eq(userHabits.address, user))
  }
}
