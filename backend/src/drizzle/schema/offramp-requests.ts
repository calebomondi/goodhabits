import { pgTable, serial, text, numeric, timestamp } from 'drizzle-orm/pg-core'

export const offrampRequests = pgTable('offramp_requests', {
  id: serial('id').primaryKey(),
  userAddress: text('user_address').notNull(),
  amountG: numeric('amount_g').notNull(),
  amountFiat: numeric('amount_fiat').notNull(),
  rateUsed: numeric('rate_used').notNull(),
  targetCurrency: text('target_currency').notNull().default('USD'),
  usdcRecipient: text('usdc_recipient'),
  beneficiary: text('beneficiary'),
  status: text('status').notNull().default('pending'),
  txHash: text('tx_hash'),
  swapTxHash: text('swap_tx_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
