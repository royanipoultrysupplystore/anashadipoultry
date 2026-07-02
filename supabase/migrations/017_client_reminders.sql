-- Migration 017: per-client payment-reminder timers.
-- A client account (farms.kind = 'client') can schedule a follow-up: "remind me
-- in N minutes / hours / days". When remind_at passes, a popup surfaces on the
-- dashboard showing the client's remaining balance and offers to send a WhatsApp
-- balance reminder. status: 'pending' until acted on, then 'done'. Idempotent.
create table if not exists client_reminders (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  remind_at timestamptz not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz default now()
);
create index if not exists idx_client_reminders_pending on client_reminders (status, remind_at);
