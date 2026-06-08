CREATE TABLE IF NOT EXISTS "indexer_state" (
  "id" text PRIMARY KEY DEFAULT 'default',
  "last_indexed_block" numeric NOT NULL DEFAULT '0',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed the default row so we always have one
INSERT INTO "indexer_state" ("id", "last_indexed_block") VALUES ('default', '0') ON CONFLICT ("id") DO NOTHING;
