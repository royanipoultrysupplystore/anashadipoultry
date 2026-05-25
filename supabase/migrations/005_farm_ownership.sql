-- Migration 005: Farm ownership — Anas Hadi runs their OWN farms plus CONTRACTOR farms.
-- Applies only to kind='farm' rows (clients/stores ignore it). Idempotent.

alter table farms add column if not exists ownership text not null default 'own';
alter table farms drop constraint if exists farms_ownership_check;
alter table farms add constraint farms_ownership_check check (ownership in ('own', 'contractor'));
