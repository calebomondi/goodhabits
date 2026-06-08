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
CREATE INDEX "idx_user_txns_user_date" ON "user_transactions" USING btree ("user_address","date" DESC NULLS LAST);