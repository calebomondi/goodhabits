import { pgTable, bigserial, bigint, timestamp, numeric, integer, index } from 'drizzle-orm/pg-core'

export const userStatsSnapshots = pgTable('user_stats_snapshots', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  totalUsers: integer('total_users').notNull().default(0),
  usersWithShares: integer('users_with_shares').notNull().default(0),
  usersWithHabitSet: integer('users_with_habit_set').notNull().default(0),
  avgShareBalance: numeric('avg_share_balance').notNull().default('0'),
  totalLifetimeDeposits: numeric('total_lifetime_deposits').notNull().default('0'),
  totalLifetimeWithdrawals: numeric('total_lifetime_withdrawals').notNull().default('0'),
  activeWithdrawalRequests: integer('active_withdrawal_requests').notNull().default(0),
  pendingWithdrawalValue: numeric('pending_withdrawal_value').notNull().default('0'),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
}, (table) => [
  index('idx_user_stats_ts').on(table.timestamp.desc()),
])
