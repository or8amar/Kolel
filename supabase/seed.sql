insert into public.app_admins (email)
values ('turgnr7@gmail.com')
on conflict (email) do nothing;

with inserted_contacts as (
  insert into public.contacts ("externalContactId", "fullName", phones, email, source)
  values
    ('ext-1001', 'אהרון לוי', array['+972-50-1234567'], 'aharon@example.com', 'manual'),
    ('ext-1002', 'משה כהן', array['+972-54-2345678'], 'moshe@example.com', 'csv'),
    ('ext-1003', 'דוד מזרחי', array['+972-52-3456789'], 'david@example.com', 'vcf'),
    ('ext-1004', 'שרה בן דוד', array['+972-53-1111111'], 'sara@example.com', 'browser_contacts'),
    ('ext-1005', 'יואב פרידמן', array['+972-58-2222222'], 'yoav@example.com', 'manual')
  returning id, "fullName"
)
insert into public.payment_potentials ("contactId", status, notes, "nextFollowUpAt")
select
  id,
  case
    when "fullName" = 'אהרון לוי' then 'new'::public.potential_status
    when "fullName" = 'משה כהן' then 'paid'::public.potential_status
    when "fullName" = 'דוד מזרחי' then 'potential'::public.potential_status
    when "fullName" = 'שרה בן דוד' then 'not_interested'::public.potential_status
    else 'refused'::public.potential_status
  end,
  case
    when "fullName" = 'אהרון לוי' then 'דורש פגישת המשך'
    when "fullName" = 'דוד מזרחי' then 'מעוניין לשמוע על מסלול שנתי'
    when "fullName" = 'יואב פרידמן' then 'סירב להמשיך בתרומה'
    else null
  end,
  now() + interval '3 day'
from inserted_contacts;

update public.contacts c
set "responsibleContactId" = r.id
from public.contacts r
where c."fullName" = 'דוד מזרחי' and r."fullName" = 'אהרון לוי';

insert into public.donations ("contactId", amount, currency, type, "paymentMethod", "paidAt", "enteredBy")
select id, 250.00, 'ILS', 'one_time', 'credit', now() - interval '10 day', 'turgnr7@gmail.com'
from public.contacts
where "fullName" = 'אהרון לוי';

insert into public.donations ("contactId", amount, currency, type, "paymentMethod", "paidAt", "enteredBy")
select id, 180.00, 'ILS', 'recurring', 'bank', now() - interval '2 day', 'turgnr7@gmail.com'
from public.contacts
where "fullName" = 'משה כהן';

insert into public.donations ("contactId", amount, currency, type, "paymentMethod", "paidAt", "enteredBy")
select id, 1200.00, 'ILS', 'one_time', 'nedarim_plus', now() - interval '45 day', 'turgnr7@gmail.com'
from public.contacts
where "fullName" = 'שרה בן דוד';

insert into public.donation_plans ("contactId", frequency, "startDate", "endDate", "amountPerCycle", "isActive", "paymentMethod")
select id, 'monthly', current_date - interval '90 day', null, 180.00, true, 'bank'
from public.contacts
where "fullName" = 'משה כהן';

insert into public.donation_plans ("contactId", frequency, "startDate", "endDate", "amountPerCycle", "isActive", "paymentMethod", "paymentMethodOther")
select id, 'yearly', current_date - interval '300 day', current_date - interval '10 day', 2400.00, false, 'other', 'המחאה'
from public.contacts
where "fullName" = 'יואב פרידמן';

insert into public.status_history ("contactId", "fromStatus", "toStatus", "changedAt", reason)
select id, null, 'new', now() - interval '30 day', 'יצירה ראשונית'
from public.contacts
where "fullName" = 'אהרון לוי';

insert into public.status_history ("contactId", "fromStatus", "toStatus", "changedAt", reason)
select id, 'potential', 'paid', now() - interval '20 day', 'הצטרף למסלול חודשי'
from public.contacts
where "fullName" = 'משה כהן';
