CREATE TABLE "investment_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_address" text NOT NULL,
	"amount_g" numeric NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
