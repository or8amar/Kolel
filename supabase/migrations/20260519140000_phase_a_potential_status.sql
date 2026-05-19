-- Phase A: replace potential_status enum with active + closed lifecycle values.

create type public.potential_status_new as enum (
  'new',
  'potential',
  'high',
  'paid',
  'refused',
  'not_interested'
);

alter table public.payment_potentials
  alter column status drop default;

alter table public.payment_potentials
  alter column status type public.potential_status_new
  using (
    case status::text
      when 'new_potential' then 'new'
      when 'contacted' then 'potential'
      when 'paying_active' then 'paid'
      when 'not_interested' then 'not_interested'
      when 'lapsed_payer' then 'refused'
      else 'new'
    end::public.potential_status_new
  );

alter table public.status_history
  alter column "fromStatus" type public.potential_status_new
  using (
    case
      when "fromStatus" is null then null
      when "fromStatus"::text = 'new_potential' then 'new'
      when "fromStatus"::text = 'contacted' then 'potential'
      when "fromStatus"::text = 'paying_active' then 'paid'
      when "fromStatus"::text = 'not_interested' then 'not_interested'
      when "fromStatus"::text = 'lapsed_payer' then 'refused'
      else 'new'
    end::public.potential_status_new
  );

alter table public.status_history
  alter column "toStatus" type public.potential_status_new
  using (
    case "toStatus"::text
      when 'new_potential' then 'new'
      when 'contacted' then 'potential'
      when 'paying_active' then 'paid'
      when 'not_interested' then 'not_interested'
      when 'lapsed_payer' then 'refused'
      else 'new'
    end::public.potential_status_new
  );

drop type public.potential_status;

alter type public.potential_status_new rename to potential_status;

alter table public.payment_potentials
  alter column status set default 'new'::public.potential_status;
