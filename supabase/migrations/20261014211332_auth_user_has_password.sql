-- Lets the service role see whether an auth user has a password.
-- Invited accounts can sign in from the invite link before they choose one.

create or replace function public.auth_user_has_password(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.encrypted_password, '') <> ''
  from auth.users as u
  where u.id = target_user_id
$$;

revoke all on function public.auth_user_has_password(uuid) from public;
revoke all on function public.auth_user_has_password(uuid) from anon, authenticated;
grant execute on function public.auth_user_has_password(uuid) to service_role;
