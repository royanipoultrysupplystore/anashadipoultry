-- Migration 018: per-entity login accounts (portal access).
-- An app_user with role='entity' is linked to one business entity so they can log
-- in and manage only their own account. entity_type ∈ (client|farm|supplier|saraf);
-- entity_id points at farms.id (client/farm), suppliers.id or sarafs.id.
-- Data isolation is enforced in the app (pragmatic model), not via RLS.
alter table app_users add column if not exists entity_type text;
alter table app_users add column if not exists entity_id uuid;

-- Allow the new 'entity' role (the old CHECK only permitted admin/associate).
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check check (role in ('admin', 'associate', 'entity'));

-- auth_login must now also return the entity link. Return signature changes, so
-- drop + recreate (CREATE OR REPLACE can't change the returned columns).
drop function if exists auth_login(text, text);
create function auth_login(p_username text, p_password text)
returns table(id uuid, name text, username text, role text, entity_type text, entity_id uuid)
language plpgsql
as $$
begin
  return query
  select u.id, u.name, u.username, u.role, u.entity_type, u.entity_id
  from app_users u
  where u.username = p_username and u.password = crypt(p_password, u.password);
end;
$$;
