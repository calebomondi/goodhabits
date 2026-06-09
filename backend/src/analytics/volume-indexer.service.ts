import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type PublicClient, keccak256, toHex } from 'viem'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { PUBLIC_CLIENT } from '../modules/viem.provider'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { dailyVolume } from '../drizzle/schema/daily-volume'
import { userTransactions } from '../drizzle/schema/user-transactions'
import { userHabits } from '../drizzle/schema/user-habits'
import { indexerState } from '../drizzle/schema/indexer-state'

const DEPOSIT_EVENT = keccak256(toHex('Deposit(address,uint256,uint256)'))
const WITHDRAW_EVENT = keccak256(toHex('Withdraw(address,uint256,uint8)'))
const WITHDRAWAL_REQUESTED_EVENT = keccak256(toHex('WithdrawalRequested(uint256,address,uint256,uint256)'))
const WITHDRAWAL_FINALIZED_EVENT = keccak256(toHex('WithdrawalFinalized(uint256,address,uint256)'))
const FEES_COLLECTED_EVENT = keccak256(toHex('FeesCollected(uint256,uint256)'))

const EVENT_SIGNATURES = [
  DEPOSIT_EVENT,
  WITHDRAW_EVENT,
  WITHDRAWAL_REQUESTED_EVENT,
  WITHDRAWAL_FINALIZED_EVENT,
  FEES_COLLECTED_EVENT,
]

const TARGET_SAVINGS_UNLOCK_ABI = [{
  type: 'function' as const,
  name: 'targetSavingsUnlock',
  inputs: [{ type: 'address', name: 'user' }],
  outputs: [{ type: 'uint256' }],
  stateMutability: 'view' as const,
}]

function decodeData(data: `0x${string}`, wordIndex: number): bigint {
  const start = 2 + wordIndex * 64
  return BigInt('0x' + data.slice(start, start + 64))
}

function dateFromBlockTs(ts: bigint): string {
  return new Date(Number(ts) * 1000).toISOString().slice(0, 10)
}

@Injectable()
export class VolumeIndexerService {
  private lastIndexedBlock: bigint | null = null

  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
  ) {}

  private async loadLastIndexedBlock(): Promise<void> {
    try {
      const row = await this.db
        .select()
        .from(indexerState)
        .where(eq(indexerState.id, 'default'))
        .then((r) => r[0])
      if (row?.lastIndexedBlock) {
        this.lastIndexedBlock = BigInt(row.lastIndexedBlock)
      }
    } catch {
      this.lastIndexedBlock = null
    }
  }

  private async persistLastIndexedBlock(block: bigint): Promise<void> {
    await this.db
      .update(indexerState)
      .set({ lastIndexedBlock: block.toString(), updatedAt: new Date() })
      .where(eq(indexerState.id, 'default'))
  }

  async indexEvents(snapshotBlock: bigint): Promise<void> {
    if (this.lastIndexedBlock === null) await this.loadLastIndexedBlock()

    const contractAddress = this.config.get<string>('TREASURY_CONTRACT') as `0x${string}`
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') return

    const fromBlock = (this.lastIndexedBlock ?? 0n) > 0n ? this.lastIndexedBlock! + 1n : snapshotBlock - 50000n
    if (fromBlock >= snapshotBlock) {
      return
    }

    const CHUNK = 5000n
    const logs: any[] = []
    for (let f = fromBlock; f < snapshotBlock; f += CHUNK) {
      const t = f + CHUNK > snapshotBlock ? snapshotBlock : f + CHUNK
      const chunk = await this.client.getLogs({ address: contractAddress, fromBlock: f, toBlock: t })
      logs.push(...chunk)
      await new Promise((r) => setTimeout(r, 200))
    }

    console.log('[VolumeIndexer] fetched', logs.length, 'logs total')

    const blockDates = new Map<bigint, string>()
    const blockCache = new Map<bigint, { timestamp: bigint }>()

    const updatesByDate = new Map<string, Record<string, string | number>>()
    const depositAddressesByDate = new Map<string, Set<string>>()
    const withdrawAddressesByDate = new Map<string, Set<string>>()
    const userTxns: Array<{
      userAddress: string
      type: string
      amount: string
      date: string
      blockNumber: string
    }> = []

    for (const log of logs) {
      const topic0 = log.topics[0]
      if (!topic0 || !EVENT_SIGNATURES.includes(topic0)) continue

      const blockNum = log.blockNumber ?? snapshotBlock
      let date = blockDates.get(blockNum)
      if (!date) {
        let block = blockCache.get(blockNum)
        if (!block) {
          block = await this.client.getBlock({ blockNumber: blockNum })
          blockCache.set(blockNum, block)
        }
        date = dateFromBlockTs(block.timestamp)
        blockDates.set(blockNum, date)
      }

      if (!updatesByDate.has(date)) updatesByDate.set(date, {})
      if (!depositAddressesByDate.has(date)) depositAddressesByDate.set(date, new Set())
      if (!withdrawAddressesByDate.has(date)) withdrawAddressesByDate.set(date, new Set())

      const updates = updatesByDate.get(date)!

      if (topic0 === DEPOSIT_EVENT) {
        const assets = decodeData(log.data, 0)
        updates.depositCount = (Number(updates.depositCount) || 0) + 1
        updates.depositVolume = (BigInt(updates.depositVolume || '0') + assets).toString()
        if (log.topics[1]) {
          const user = `0x${log.topics[1].slice(-40)}` as `0x${string}`
          depositAddressesByDate.get(date)!.add(user)
          userTxns.push({ userAddress: user, type: 'deposit', amount: assets.toString(), date, blockNumber: blockNum.toString() })
          console.log('[VolumeIndexer] deposit: user', user, 'amount', assets.toString(), 'date', date)
          const existing = await this.db
            .select()
            .from(userHabits)
            .where(eq(userHabits.address, user))
            .limit(1)
            .then((r) => r[0]) as typeof userHabits.$inferSelect | undefined

          const frozenUntil = existing?.pointsFrozenUntil
          const isFrozen = frozenUntil ? new Date(frozenUntil) > new Date() : false

          let currentStreak = existing?.currentStreak ?? 0
          let longestStreak = existing?.longestStreak ?? 0
          let streakStart = existing?.streakStart ?? new Date()
          let lastSaveDate = existing?.lastSaveDate ?? null
          let consistency = Number(existing?.habitConsistency ?? 0)

          if (!isFrozen) {
            const yesterday = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10)
            if (!lastSaveDate || lastSaveDate < yesterday) {
              currentStreak = 1
              streakStart = new Date()
            } else if (lastSaveDate === yesterday) {
              currentStreak += 1
            }
            if (currentStreak > longestStreak) longestStreak = currentStreak
            const daysSinceStart = Math.ceil((Date.now() - new Date(streakStart).getTime()) / 86400000)
            consistency = daysSinceStart > 0 ? currentStreak / daysSinceStart : 1
          } else {
            currentStreak = 0
            consistency = 0
          }

          const setFields: Record<string, unknown> = {
            currentStreak,
            longestStreak,
            habitConsistency: consistency.toString(),
            updatedAt: new Date(),
          }
          if (!isFrozen) {
            setFields.lastSaveDate = date
            setFields.streakStart = streakStart
          }

          await this.db.insert(userHabits).values({
            address: user,
            currentStreak,
            longestStreak,
            lastSaveDate: date,
            streakStart,
            habitConsistency: consistency.toString(),
          }).onConflictDoUpdate({
            target: userHabits.address,
            set: setFields,
          })
        }
      } else if (topic0 === WITHDRAW_EVENT) {
        const amount = decodeData(log.data, 0)
        const from = Number(decodeData(log.data, 1))
        if (from === 0) {
          updates.spendableWithdrawals = (BigInt(updates.spendableWithdrawals || '0') + amount).toString()
        } else {
          updates.savingsWithdrawals = (BigInt(updates.savingsWithdrawals || '0') + amount).toString()
        }
        if (log.topics[1]) {
          const user = `0x${log.topics[1].slice(-40)}` as `0x${string}`
          withdrawAddressesByDate.get(date)!.add(user)
          const txnType = from === 0 ? 'withdraw_spendable' : 'withdraw_savings'
          userTxns.push({ userAddress: user, type: txnType, amount: amount.toString(), date, blockNumber: blockNum.toString() })

          if (from === 1) {
            try {
              const block = blockCache.get(blockNum) ?? await this.client.getBlock({ blockNumber: blockNum })
              blockCache.set(blockNum, block)
              const unlockTs = await this.client.readContract({
                address: contractAddress,
                abi: TARGET_SAVINGS_UNLOCK_ABI,
                functionName: 'targetSavingsUnlock',
                args: [user],
              })
              if (block.timestamp < unlockTs) {
                const frozenUntil = new Date(Date.now() + 7 * 86400000)
                await this.db.update(userHabits)
                  .set({
                    currentStreak: 0,
                    streakBreakCount: sql`COALESCE(${userHabits.streakBreakCount}, 0) + 1`,
                    pointsFrozenUntil: frozenUntil,
                    recoveryBonusUsed: false,
                    updatedAt: new Date(),
                  })
                  .where(eq(userHabits.address, user))
              }
            } catch {
              // skip if read fails (e.g. contract doesn't have a lock set)
            }
          }
        }
      } else if (topic0 === WITHDRAWAL_REQUESTED_EVENT) {
        const sharesLocked = decodeData(log.data, 0)
        updates.withdrawalRequestCount = (Number(updates.withdrawalRequestCount) || 0) + 1
        updates.withdrawalRequestVolume = (BigInt(updates.withdrawalRequestVolume || '0') + sharesLocked).toString()
        if (log.topics[2]) withdrawAddressesByDate.get(date)!.add(`0x${log.topics[2].slice(-40)}`)
      } else if (topic0 === WITHDRAWAL_FINALIZED_EVENT) {
        const assets = decodeData(log.data, 0)
        updates.withdrawalFinalizedCount = (Number(updates.withdrawalFinalizedCount) || 0) + 1
        updates.withdrawalFinalizedVolume = (BigInt(updates.withdrawalFinalizedVolume || '0') + assets).toString()
        if (log.topics[2]) {
          const user = `0x${log.topics[2].slice(-40)}` as `0x${string}`
          userTxns.push({ userAddress: user, type: 'withdrawal_finalized', amount: assets.toString(), date, blockNumber: blockNum.toString() })
        }
      } else if (topic0 === FEES_COLLECTED_EVENT) {
        const feeAmount = decodeData(log.data, 1)
        updates.feeCollected = (BigInt(updates.feeCollected || '0') + feeAmount).toString()
      }
    }

    if (userTxns.length > 0) {
      const addresses = [...new Set(userTxns.map(t => t.userAddress))]
      const existing = await this.db
        .select({ userAddress: userTransactions.userAddress, blockNumber: userTransactions.blockNumber, type: userTransactions.type })
        .from(userTransactions)
        .where(and(
          inArray(userTransactions.userAddress, addresses),
          inArray(userTransactions.blockNumber, [...new Set(userTxns.map(t => t.blockNumber))]),
        ))
      const existingKeys = new Set(existing.map(r => `${r.userAddress}:${r.blockNumber}:${r.type}`))
      const toInsert = userTxns.filter(t => !existingKeys.has(`${t.userAddress}:${t.blockNumber}:${t.type}`))
      if (toInsert.length > 0) {
        await this.db.insert(userTransactions).values(toInsert)
        console.log('[VolumeIndexer] inserted', toInsert.length, 'user transactions')
      } else {
        console.log('[VolumeIndexer] all user transactions already exist, skipping')
      }
    } else {
      console.log('[VolumeIndexer] no user transactions to insert')
    }

    for (const [date, updates] of updatesByDate) {
      updates.uniqueDepositors = depositAddressesByDate.get(date)?.size ?? 0
      updates.uniqueWithdrawers = withdrawAddressesByDate.get(date)?.size ?? 0

      let row = await this.db
        .select()
        .from(dailyVolume)
        .where(eq(dailyVolume.date, date))
        .then((r) => r[0])

      if (!row) {
        await this.db.insert(dailyVolume).values({ date })
        row = await this.db
          .select()
          .from(dailyVolume)
          .where(eq(dailyVolume.date, date))
          .then((r) => r[0])
      }

      const merged: Record<string, string | number> = {}
      for (const [key, val] of Object.entries(updates)) {
        const existing = (row as any)?.[key]
        if (typeof val === 'string' && typeof existing === 'string') {
          merged[key] = (BigInt(existing || '0') + BigInt(val)).toString()
        } else if (typeof val === 'number' && typeof existing === 'number') {
          merged[key] = (existing || 0) + val
        } else {
          merged[key] = val
        }
      }

      await this.db
        .update(dailyVolume)
        .set({ ...merged, updatedAt: new Date() })
        .where(eq(dailyVolume.date, date))
    }

    this.lastIndexedBlock = snapshotBlock
    await this.persistLastIndexedBlock(snapshotBlock)
  }

  private async fetchUserEvents(user: `0x${string}`, fromBlock: bigint, toBlock: bigint): Promise<Array<{
    userAddress: string
    type: string
    amount: string
    date: string
    blockNumber: string
  }>> {
    const contractAddress = this.config.get<string>('TREASURY_CONTRACT') as `0x${string}`
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') return []

    if (fromBlock >= toBlock) return []

    const logs = await this.client.getLogs({
      address: contractAddress,
      fromBlock,
      toBlock,
    })

    const lowerUser = user.toLowerCase()
    const result: Array<{
      userAddress: string
      type: string
      amount: string
      date: string
      blockNumber: string
    }> = []

    for (const log of logs) {
      const topic0 = log.topics[0]
      if (!topic0 || !EVENT_SIGNATURES.includes(topic0)) continue

      let eventUser: string | null = null
      let type = ''
      let amount = 0n

      if (topic0 === DEPOSIT_EVENT && log.topics[1]) {
        eventUser = `0x${log.topics[1].slice(-40)}`
        type = 'deposit'
        amount = decodeData(log.data, 0)
      } else if (topic0 === WITHDRAW_EVENT && log.topics[1]) {
        eventUser = `0x${log.topics[1].slice(-40)}`
        const from = Number(decodeData(log.data, 1))
        type = from === 0 ? 'withdraw_spendable' : 'withdraw_savings'
        amount = decodeData(log.data, 0)
      } else if (topic0 === WITHDRAWAL_FINALIZED_EVENT && log.topics[2]) {
        eventUser = `0x${log.topics[2].slice(-40)}`
        type = 'withdrawal_finalized'
        amount = decodeData(log.data, 0)
      }

      if (!eventUser || eventUser.toLowerCase() !== lowerUser || amount === 0n) continue

      const blockNum = typeof log.blockNumber === 'bigint' ? log.blockNumber : BigInt(log.blockNumber)
      const block = await this.client.getBlock({ blockNumber: blockNum })
      const date = dateFromBlockTs(block.timestamp)

      result.push({
        userAddress: eventUser,
        type,
        amount: amount.toString(),
        date,
        blockNumber: blockNum.toString(),
      })
    }

    return result
  }

  async indexUserEventByTxHash(user: `0x${string}`, txHash: `0x${string}`): Promise<number> {
    const contractAddress = this.config.get<string>('TREASURY_CONTRACT') as `0x${string}`
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') return 0

    const receipt = await this.client.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') return 0

    const block = await this.client.getBlock({ blockNumber: receipt.blockNumber })
    const date = dateFromBlockTs(block.timestamp)
    const lowerUser = user.toLowerCase()

    let inserted = 0
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue

      const topic0 = log.topics[0]
      if (!topic0 || !EVENT_SIGNATURES.includes(topic0)) continue

      let eventUser: string | null = null
      let type = ''
      let amount = 0n

      if (topic0 === DEPOSIT_EVENT && log.topics[1]) {
        eventUser = `0x${log.topics[1].slice(-40)}`
        type = 'deposit'
        amount = decodeData(log.data, 0)
      } else if (topic0 === WITHDRAW_EVENT && log.topics[1]) {
        eventUser = `0x${log.topics[1].slice(-40)}`
        const from = Number(decodeData(log.data, 1))
        type = from === 0 ? 'withdraw_spendable' : 'withdraw_savings'
        amount = decodeData(log.data, 0)
      } else if (topic0 === WITHDRAWAL_FINALIZED_EVENT && log.topics[2]) {
        eventUser = `0x${log.topics[2].slice(-40)}`
        type = 'withdrawal_finalized'
        amount = decodeData(log.data, 0)
      }

      if (!eventUser || eventUser.toLowerCase() !== lowerUser || amount === 0n) continue

      const bn = typeof receipt.blockNumber === 'bigint' ? receipt.blockNumber : BigInt(receipt.blockNumber)

      const existing = await this.db
        .select({ id: userTransactions.id })
        .from(userTransactions)
        .where(and(
          eq(userTransactions.userAddress, lowerUser),
          eq(userTransactions.blockNumber, bn.toString()),
          eq(userTransactions.type, type),
        ))
        .limit(1)

      if (existing.length > 0) continue

      await this.db.insert(userTransactions).values({
        userAddress: eventUser,
        type,
        amount: amount.toString(),
        date,
        blockNumber: bn.toString(),
      })
      inserted++
      console.log(`[VolumeIndexer] indexed ${type} from tx ${txHash} for ${eventUser}: ${amount}`)
    }

    return inserted
  }

  async indexUserEvents(user: `0x${string}`, currentBlock: bigint): Promise<void> {
    const fromBlock = currentBlock - 200n > 0n ? currentBlock - 200n : 0n
    if (fromBlock >= currentBlock) return

    let userTxns = await this.fetchUserEvents(user, fromBlock, currentBlock)

    if (userTxns.length === 0) {
      await new Promise(r => setTimeout(r, 2000))
      userTxns = await this.fetchUserEvents(user, fromBlock, currentBlock)
    }

    if (userTxns.length === 0) return

    const existing = await this.db
      .select({ blockNumber: userTransactions.blockNumber, type: userTransactions.type })
      .from(userTransactions)
      .where(and(
        eq(userTransactions.userAddress, user.toLowerCase()),
      ))

    const existingKeys = new Set(existing.map(r => `${r.blockNumber}:${r.type}`))
    const toInsert = userTxns.filter(t => !existingKeys.has(`${t.blockNumber}:${t.type}`))

    if (toInsert.length === 0) return

    await this.db.insert(userTransactions).values(toInsert)
    console.log(`[VolumeIndexer] indexed ${toInsert.length} user events for ${user}`)
  }
}
