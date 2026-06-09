import { pgTable, bigserial, text, numeric, timestamp } from 'drizzle-orm/pg-core'

// PLACEHOLDER: Investment withdrawal request queue
// In the future this will trigger on-chain requestWithdrawal()
// For now, it simply logs user intent so the queue can be inspected.
export const investmentRequests = pgTable('investment_requests', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  userAddress: text('user_address').notNull(),
  amountG: numeric('amount_g').notNull(),
  status: text('status').notNull().default('pending'), // pending | completed | cancelled
  txHash: text('tx_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
