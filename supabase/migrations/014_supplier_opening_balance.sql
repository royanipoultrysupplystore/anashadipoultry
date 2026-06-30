-- Migration 014: opening balance per supplier — carry-over of what the shop
-- already owed a supplier before adopting this system. Feeds the supplier's
-- "remaining" as an additive constant. Idempotent.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
