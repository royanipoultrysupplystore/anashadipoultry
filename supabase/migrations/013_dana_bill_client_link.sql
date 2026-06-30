-- Migration 013: link a meel bill (supplier_dispatches) to the client it was
-- written for, so a "Dana Bill" written from the client account shows in BOTH
-- the client's and the supplier's account. Nullable so existing broker bills
-- (client side tracked via dispatches) are unaffected. Idempotent.
ALTER TABLE supplier_dispatches ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES farms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_dispatches_farm_id ON supplier_dispatches(farm_id);
