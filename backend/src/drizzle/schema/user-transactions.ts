import { pgTable, bigserial, date, timestamp, numeric, varchar, index } from 'drizzle-orm/pg-core'

export const userTransactions = pgTable('user_transactions', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  userAddress: varchar('user_address', { length: 42 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  amount: numeric('amount').notNull().default('0'),
  date: date('date').notNull(),
  blockNumber: numeric('block_number').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_user_txns_user_date').on(table.userAddress, table.date.desc()),
])
