ALTER TABLE offramp_requests
  ADD COLUMN target_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN usdc_recipient text,
  ADD COLUMN swap_tx_hash text;

ALTER TABLE offramp_requests ALTER COLUMN beneficiary DROP NOT NULL;
