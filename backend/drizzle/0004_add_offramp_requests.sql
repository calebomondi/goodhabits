CREATE TABLE IF NOT EXISTS "offramp_requests" (
  "id" serial PRIMARY KEY,
  "user_address" text NOT NULL,
  "amount_g" numeric NOT NULL,
  "amount_fiat" numeric NOT NULL,
  "rate_used" numeric NOT NULL,
  "beneficiary" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "tx_hash" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
