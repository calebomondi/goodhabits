import { pgTable, bigserial, bigint, timestamp, numeric, integer, boolean, index } from 'drizzle-orm/pg-core'

export const positionSnapshots = pgTable('position_snapshots', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  value: numeric('value').notNull(),
  gAmount: numeric('g_amount').notNull().default('0'),
  cusdAmount: numeric('cusd_amount').notNull().default('0'),
  feesOwedG: numeric('fees_owed_g').notNull().default('0'),
  feesOwedCusd: numeric('fees_owed_cusd').notNull().default('0'),
  liquidity: numeric('liquidity').notNull(),
  tickLower: integer('tick_lower').notNull(),
  tickUpper: integer('tick_upper').notNull(),
  currentTick: integer('current_tick').notNull(),
  inRange: boolean('in_range').notNull(),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
}, (table) => [
  index('idx_pos_snapshots_token_ts').on(table.tokenId, table.timestamp.desc()),
])
