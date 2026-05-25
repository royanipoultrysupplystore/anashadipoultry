-- Migration 007: link each dispatch_item back to the supplier_dispatch (meel bill)
-- the bags were drawn from, so per-supplier dispatched/remaining stock is accurate.
-- Idempotent.
alter table dispatch_items
  add column if not exists supplier_dispatch_id uuid references supplier_dispatches(id) on delete set null;

create index if not exists idx_dispatch_items_supplier_dispatch_id
  on dispatch_items(supplier_dispatch_id);
