-- Migration 012: opening balance — carry-over historical debt per farm/client.
-- Lets businesses backfill what a farm already owed before adopting this system
-- without entering thousands of past dispatches. Feeds the current_debt formula
-- as an additive constant. Idempotent.
ALTER TABLE farms ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
