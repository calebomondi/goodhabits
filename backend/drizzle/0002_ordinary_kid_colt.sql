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
ALTER TABLE "user_habits" ADD COLUMN "points_frozen_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_habits" ADD COLUMN "streak_break_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_habits" ADD COLUMN "recovery_bonus_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_pos_registry_active" ON "position_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pos_registry_ticks" ON "position_registry" USING btree ("tick_lower","tick_upper");