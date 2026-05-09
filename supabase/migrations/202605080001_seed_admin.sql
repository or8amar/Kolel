insert into public.app_admins (email)
values ('turgnr7@gmail.com')
on conflict (email) do nothing;
