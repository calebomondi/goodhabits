import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core'

export const indexerState = pgTable('indexer_state', {
  id: text('id').primaryKey().default('default'),
  lastIndexedBlock: numeric('last_indexed_block').notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
