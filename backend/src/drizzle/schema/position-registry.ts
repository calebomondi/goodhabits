import { pgTable, bigserial, bigint, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'

export const positionRegistry = pgTable('position_registry', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tokenId: bigint('token_id', { mode: 'bigint' }).notNull().unique(),
  tickLower: integer('tick_lower').notNull(),
  tickUpper: integer('tick_upper').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_pos_registry_active').on(table.isActive),
  index('idx_pos_registry_ticks').on(table.tickLower, table.tickUpper),
])
