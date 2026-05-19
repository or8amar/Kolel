-- Phase B: responsible contact, payment method on donations and plans

create type public.payment_method as enum (
  'credit',
  'bank',
  'nedarim_plus',
  'other'
);

alter table public.contacts
  add column if not exists "responsibleContactId" uuid references public.contacts(id) on delete set null;

create index if not exists idx_contacts_responsible on public.contacts ("responsibleContactId");

alter table public.donations
  add column if not exists "paymentMethod" public.payment_method,
  add column if not exists "paymentMethodOther" text;

alter table public.donation_plans
  add column if not exists "paymentMethod" public.payment_method,
  add column if not exists "paymentMethodOther" text;
