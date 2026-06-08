import { pgTable, bigserial, date, timestamp, numeric, integer, index } from 'drizzle-orm/pg-core'

export const dailyVolume = pgTable('daily_volume', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  date: date('date').notNull().unique(),
  depositCount: integer('deposit_count').notNull().default(0),
  depositVolume: numeric('deposit_volume').notNull().default('0'),
  withdrawalRequestCount: integer('withdrawal_request_count').notNull().default(0),
  withdrawalRequestVolume: numeric('withdrawal_request_volume').notNull().default('0'),
  withdrawalFinalizedCount: integer('withdrawal_finalized_count').notNull().default(0),
  withdrawalFinalizedVolume: numeric('withdrawal_finalized_volume').notNull().default('0'),
  spendableWithdrawals: numeric('spendable_withdrawals').notNull().default('0'),
  savingsWithdrawals: numeric('savings_withdrawals').notNull().default('0'),
  uniqueDepositors: integer('unique_depositors').notNull().default(0),
  uniqueWithdrawers: integer('unique_withdrawers').notNull().default(0),
  feeCollected: numeric('fee_collected').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_daily_volume_date').on(table.date.desc()),
])
