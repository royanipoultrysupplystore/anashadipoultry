-- Migration 015: opening balances per Saraf (money exchanger) for businesses
-- that ran for years before this system.
--   opening_holding  = money the Saraf already holds for the shop (adds to holding)
--   opening_overpaid = money the Saraf already paid out beyond receipts, i.e.
--                      it fronted for the shop/clients (reduces holding)
-- Currently holding = opening_holding - opening_overpaid + IN - OUT. Idempotent.
ALTER TABLE sarafs ADD COLUMN IF NOT EXISTS opening_holding numeric DEFAULT 0;
ALTER TABLE sarafs ADD COLUMN IF NOT EXISTS opening_overpaid numeric DEFAULT 0;
