-- is_admin() queried app_admins while app_admins RLS also called is_admin(),
-- causing "stack depth limit exceeded" on bulk writes (e.g. contact import).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins a
    where lower(a.email) = lower(coalesce(auth.email(), ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

drop policy if exists "admins can read app_admins" on public.app_admins;

create policy "admins can read app_admins"
  on public.app_admins
  for select
  using (lower(email) = lower(coalesce(auth.email(), '')));
