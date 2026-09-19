-- Migration 021: vaccines as a first-class dispatch line, mirroring choza.
--
-- A vaccine purchase is one vaccine_transactions row against a supplier (what we
-- owe them); dispatching doses to a farm links the dispatch_item back to that lot
-- so per-supplier remaining stock and per-farm vaccine debt are both computable.
create table if not exists vaccine_transactions (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete cascade,
  transaction_date date not null default current_date,
  vaccine_name text not null,
  quantity integer default 0,
  price_per_unit numeric default 0,
  total_amount numeric default 0,
  sale_price_per_unit numeric default 0,
  total_profit numeric default 0,
  notes text,
  created_at timestamp with time zone default now()
);
alter table vaccine_transactions disable row level security;

create index if not exists idx_vaccine_transactions_supplier_id on vaccine_transactions(supplier_id);

-- Same attribution link choza and meel already have.
alter table dispatch_items
  add column if not exists vaccine_transaction_id uuid references vaccine_transactions(id) on delete set null;
create index if not exists idx_dispatch_items_vaccine_transaction_id
  on dispatch_items(vaccine_transaction_id);

-- Vaccines get their own product type so they never mix with medicine stock.
alter table products drop constraint if exists products_type_check;
alter table products add constraint products_type_check
  check (type in ('medicine', 'food', 'meel', 'choza', 'vaccine'));
