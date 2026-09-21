-- Migration 022: attribute a dispatched medicine line to the purchase it came from.
--
-- Medicine is bought as a stock_purchases row against a supplier. Until now a
-- dispatch could not say which purchase its units came out of, so per-supplier
-- remaining stock was not computable — the same gap meel, choza and vaccines
-- have already had closed (supplier_dispatch_id / choza_transaction_id /
-- vaccine_transaction_id).
alter table dispatch_items
  add column if not exists stock_purchase_id uuid references stock_purchases(id) on delete set null;

create index if not exists idx_dispatch_items_stock_purchase_id
  on dispatch_items(stock_purchase_id);
