-- Migration 020: attribute a dispatched choza line to the supplier lot it came from.
--
-- Buying choza writes a choza_transactions row and tops up a single shared
-- "Choza - <type>" product, so every supplier's chicks land in one pool and the
-- dispatch screen cannot show which supplier a bird came from. This mirrors the
-- meel pattern (dispatch_items.supplier_dispatch_id) for choza, so per-supplier
-- remaining stock = lot.total_choza - sum(dispatch_items.quantity) for that lot.
alter table dispatch_items
  add column if not exists choza_transaction_id uuid references choza_transactions(id) on delete set null;

create index if not exists idx_dispatch_items_choza_transaction_id
  on dispatch_items(choza_transaction_id);
