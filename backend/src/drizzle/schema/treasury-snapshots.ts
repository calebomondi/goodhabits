import { pgTable, bigserial, bigint, timestamp, numeric, integer, text, index } from 'drizzle-orm/pg-core'

export const treasurySnapshots = pgTable('treasury_snapshots', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  totalAssets: numeric('total_assets').notNull(),
  idleAssets: numeric('idle_assets').notNull(),
  deployedAssets: numeric('deployed_assets').notNull(),
  reservedAssets: numeric('reserved_assets').notNull(),
  positionValue: numeric('position_value').notNull(),
  totalShares: numeric('total_shares').notNull(),
  pricePerShare: numeric('price_per_share').notNull(),
  accruedFees: numeric('accrued_fees').notNull(),
  activePositions: integer('active_positions').notNull().default(0),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  txHash: text('tx_hash'),
}, (table) => [
  index('idx_snapshots_ts').on(table.timestamp.desc()),
])
