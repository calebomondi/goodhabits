ALTER TABLE "user_habits" ADD COLUMN "points_frozen_until" timestamp with time zone;
ALTER TABLE "user_habits" ADD COLUMN "streak_break_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "user_habits" ADD COLUMN "recovery_bonus_used" boolean NOT NULL DEFAULT false;
