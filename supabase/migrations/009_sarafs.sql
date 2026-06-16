-- Migration 009: Saraf (money exchanger) entity + payment links
-- A Saraf is a third party that holds money between client and supplier.
-- Clients send money IN to a Saraf; the Saraf sends money OUT to suppliers.
-- A Saraf's balance = (received from clients) - (paid to suppliers); zero when
-- everything is settled. Idempotent.

create table if not exists sarafs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  location text,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table sarafs enable row level security;
drop policy if exists "Allow all" on sarafs;
create policy "Allow all" on sarafs for all using (true) with check (true);

-- A client payment recorded "via a Saraf" — money the client sent to that Saraf
-- on account of a bill. saraf_id is nullable so direct cash payments still work.
alter table payments
  add column if not exists saraf_id uuid references sarafs(id) on delete set null;

-- A supplier payment recorded "via a Saraf" — money the Saraf released to the
-- meel on account of a bill. saraf_id nullable so direct payments still work.
alter table supplier_payments
  add column if not exists saraf_id uuid references sarafs(id) on delete set null;

create index if not exists idx_payments_saraf_id on payments(saraf_id);
create index if not exists idx_supplier_payments_saraf_id on supplier_payments(saraf_id);
