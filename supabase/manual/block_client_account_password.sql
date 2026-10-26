-- Aussie Grid — block recoverable Tesla (and any OEM) passwords from the anon client.
-- File: supabase/manual/block_client_account_password.sql
--
-- This frontend deploy does not apply SQL. Run this once in the Supabase SQL
-- editor (postgres / privileged role) after the client that stops sending
-- account_password is deployed. Until then, a hand-written PostgREST insert
-- can still store a password if column privileges allow it.
--
-- anon and authenticated may not set a non-null account_password.
-- They may leave an existing value unchanged, or clear it (set null).
-- service_role is unchanged, for a future server-side secret manager.
-- Do not collect the password in the browser either way.

create or replace function public.block_client_account_password()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.account_password is not null then
      raise exception 'account_password cannot be set by the client'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
       and new.account_password is not null
       and new.account_password is distinct from old.account_password then
      raise exception 'account_password cannot be set by the client'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pilot_connection_requests_block_client_account_password
  on public.pilot_connection_requests;

create trigger pilot_connection_requests_block_client_account_password
  before insert or update on public.pilot_connection_requests
  for each row
  execute function public.block_client_account_password();

revoke all on function public.block_client_account_password() from public, anon, authenticated;
