create extension if not exists pgcrypto;

create type public.potential_status as enum (
  'new_potential',
  'contacted',
  'paying_active',
  'not_interested',
  'lapsed_payer'
);
create type public.contact_source as enum ('manual', 'browser_contacts', 'csv', 'vcf');
create type public.donation_type as enum ('one_time', 'recurring');
create type public.plan_frequency as enum ('monthly', 'yearly');

create table if not exists public.app_admins (
  email text primary key
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  "externalContactId" text,
  "fullName" text not null,
  phones text[] not null default '{}',
  email text,
  source public.contact_source not null default 'manual',
  "createdAt" timestamptz not null default now()
);

create table if not exists public.payment_potentials (
  id uuid primary key default gen_random_uuid(),
  "contactId" uuid not null references public.contacts(id) on delete cascade,
  status public.potential_status not null default 'new_potential',
  priority int not null default 3 check (priority between 1 and 5),
  notes text,
  "nextFollowUpAt" timestamptz,
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  "contactId" uuid not null references public.contacts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ILS',
  type public.donation_type not null,
  "paidAt" timestamptz not null default now(),
  "enteredBy" text
);

create table if not exists public.donation_plans (
  id uuid primary key default gen_random_uuid(),
  "contactId" uuid not null references public.contacts(id) on delete cascade,
  frequency public.plan_frequency not null,
  "startDate" date not null,
  "endDate" date,
  "amountPerCycle" numeric(12,2) not null check ("amountPerCycle" > 0),
  "isActive" boolean not null default true
);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  "contactId" uuid not null references public.contacts(id) on delete cascade,
  "fromStatus" public.potential_status,
  "toStatus" public.potential_status not null,
  "changedAt" timestamptz not null default now(),
  reason text
);

create index if not exists idx_potentials_contact on public.payment_potentials ("contactId");
create index if not exists idx_donations_contact on public.donations ("contactId");
create index if not exists idx_plans_contact on public.donation_plans ("contactId");
create index if not exists idx_status_history_contact on public.status_history ("contactId");

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_admins a
    where lower(a.email) = lower(coalesce(auth.email(), ''))
  );
$$;

alter table public.app_admins enable row level security;
alter table public.contacts enable row level security;
alter table public.payment_potentials enable row level security;
alter table public.donations enable row level security;
alter table public.donation_plans enable row level security;
alter table public.status_history enable row level security;

create policy "admins can read app_admins"
  on public.app_admins
  for select
  using (public.is_admin());

create policy "admins manage contacts"
  on public.contacts
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage payment potentials"
  on public.payment_potentials
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage donations"
  on public.donations
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage donation plans"
  on public.donation_plans
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage status history"
  on public.status_history
  for all
  using (public.is_admin())
  with check (public.is_admin());
