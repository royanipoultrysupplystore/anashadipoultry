-- Migration 016: hawala (transaction) number for Saraf money movements.
-- When money moves through a Saraf, brokers track a transaction / حواله number.
--   Record IN  (payments row with saraf_id)          → hawala number is required
--   Record OUT (supplier_payments row with saraf_id)  → hawala number is optional
-- Stored as free text (numbers can have letters / dashes). Idempotent.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS hawala_number text;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS hawala_number text;
