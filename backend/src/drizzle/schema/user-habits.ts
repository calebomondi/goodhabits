import { pgTable, text, integer, numeric, timestamp, date, boolean } from 'drizzle-orm/pg-core'

export const userHabits = pgTable('user_habits', {
  address: text('address').primaryKey(),
  totalSaved: numeric('total_saved').notNull().default('0'),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  streakStart: timestamp('streak_start', { withTimezone: true }),
  lastSaveDate: date('last_save_date'),
  streakBrokenCount: integer('streak_broken_count').notNull().default(0),
  points: numeric('points').notNull().default('0'),
  habitSpendPct: integer('habit_spend_pct').notNull().default(40),
  habitSavePct: integer('habit_save_pct').notNull().default(30),
  habitInvestPct: integer('habit_invest_pct').notNull().default(30),
  habitConsistency: numeric('habit_consistency').notNull().default('0'),
  pointsFrozenUntil: timestamp('points_frozen_until', { withTimezone: true }),
  streakBreakCount: integer('streak_break_count').notNull().default(0),
  recoveryBonusUsed: boolean('recovery_bonus_used').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
