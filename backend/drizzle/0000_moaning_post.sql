CREATE TABLE "daily_volume" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"deposit_count" integer DEFAULT 0 NOT NULL,
	"deposit_volume" numeric DEFAULT '0' NOT NULL,
	"withdrawal_request_count" integer DEFAULT 0 NOT NULL,
	"withdrawal_request_volume" numeric DEFAULT '0' NOT NULL,
	"withdrawal_finalized_count" integer DEFAULT 0 NOT NULL,
	"withdrawal_finalized_volume" numeric DEFAULT '0' NOT NULL,
	"spendable_withdrawals" numeric DEFAULT '0' NOT NULL,
	"savings_withdrawals" numeric DEFAULT '0' NOT NULL,
	"unique_depositors" integer DEFAULT 0 NOT NULL,
	"unique_withdrawers" integer DEFAULT 0 NOT NULL,
	"fee_collected" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_volume_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "indexer_state" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"last_indexed_block" numeric DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offramp_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_address" text NOT NULL,
	"amount_g" numeric NOT NULL,
	"amount_fiat" numeric NOT NULL,
	"rate_used" numeric NOT NULL,
	"target_currency" text DEFAULT 'USD' NOT NULL,
	"usdc_recipient" text,
	"beneficiary" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"swap_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_registry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_id" bigint NOT NULL,
	"tick_lower" integer NOT NULL,
	"tick_upper" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "position_registry_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
CREATE TABLE "position_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_id" bigint NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"value" numeric NOT NULL,
	"g_amount" numeric DEFAULT '0' NOT NULL,
	"cusd_amount" numeric DEFAULT '0' NOT NULL,
	"fees_owed_g" numeric DEFAULT '0' NOT NULL,
	"fees_owed_cusd" numeric DEFAULT '0' NOT NULL,
	"liquidity" numeric NOT NULL,
	"tick_lower" integer NOT NULL,
	"tick_upper" integer NOT NULL,
	"current_tick" integer NOT NULL,
	"in_range" boolean NOT NULL,
	"block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"total_assets" numeric NOT NULL,
	"idle_assets" numeric NOT NULL,
	"deployed_assets" numeric NOT NULL,
	"reserved_assets" numeric NOT NULL,
	"position_value" numeric NOT NULL,
	"total_shares" numeric NOT NULL,
	"price_per_share" numeric NOT NULL,
	"accrued_fees" numeric NOT NULL,
	"active_positions" integer DEFAULT 0 NOT NULL,
	"block_number" bigint NOT NULL,
	"tx_hash" text
);
--> statement-breakpoint
CREATE TABLE "user_habits" (
	"address" text PRIMARY KEY NOT NULL,
	"total_saved" numeric DEFAULT '0' NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"streak_start" timestamp with time zone,
	"last_save_date" date,
	"streak_broken_count" integer DEFAULT 0 NOT NULL,
	"points" numeric DEFAULT '0' NOT NULL,
	"habit_spend_pct" integer DEFAULT 40 NOT NULL,
	"habit_save_pct" integer DEFAULT 30 NOT NULL,
	"habit_invest_pct" integer DEFAULT 30 NOT NULL,
	"habit_consistency" numeric DEFAULT '0' NOT NULL,
	"points_frozen_until" timestamp with time zone,
	"streak_break_count" integer DEFAULT 0 NOT NULL,
	"recovery_bonus_used" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"total_users" integer DEFAULT 0 NOT NULL,
	"users_with_shares" integer DEFAULT 0 NOT NULL,
	"users_with_habit_set" integer DEFAULT 0 NOT NULL,
	"avg_share_balance" numeric DEFAULT '0' NOT NULL,
	"total_lifetime_deposits" numeric DEFAULT '0' NOT NULL,
	"total_lifetime_withdrawals" numeric DEFAULT '0' NOT NULL,
	"active_withdrawal_requests" integer DEFAULT 0 NOT NULL,
	"pending_withdrawal_value" numeric DEFAULT '0' NOT NULL,
	"block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_address" varchar(42) NOT NULL,
	"type" varchar(32) NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"date" date NOT NULL,
	"block_number" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_daily_volume_date" ON "daily_volume" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_pos_registry_active" ON "position_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pos_registry_ticks" ON "position_registry" USING btree ("tick_lower","tick_upper");--> statement-breakpoint
CREATE INDEX "idx_pos_snapshots_token_ts" ON "position_snapshots" USING btree ("token_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_snapshots_ts" ON "treasury_snapshots" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_user_stats_ts" ON "user_stats_snapshots" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_user_txns_user_date" ON "user_transactions" USING btree ("user_address","date" DESC NULLS LAST);