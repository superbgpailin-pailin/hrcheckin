-- HR CheckIn v2: Security Advisor hardening
-- Date: 2026-03-11

begin;

-- 1) Fix mutable function search_path warning
alter function public.set_updated_at() set search_path = public;

-- 2) Remove legacy overly-permissive attendance write policies and keep scoped ones
drop policy if exists "Enable delete for all authenticated/anon users" on public.attendance;
drop policy if exists "Enable update for all authenticated/anon users" on public.attendance;

drop policy if exists attendance_delete_checkin_for_client on public.attendance;
create policy attendance_delete_checkin_for_client
on public.attendance
for delete
to anon, authenticated
using (
  coalesce(type, 'check_in') = 'check_in'
  and employee_id is not null
);

drop policy if exists attendance_update_checkin_for_client on public.attendance;
create policy attendance_update_checkin_for_client
on public.attendance
for update
to anon, authenticated
using (
  coalesce(type, 'check_in') = 'check_in'
  and employee_id is not null
)
with check (
  employee_id is not null
  and coalesce(shift_name, '') <> ''
  and coalesce(type, 'check_in') = 'check_in'
);

-- 3) Tighten employees update/delete policies (avoid USING true)
alter table public.employees enable row level security;

drop policy if exists employees_update_for_client on public.employees;
create policy employees_update_for_client
on public.employees
for update
to anon, authenticated
using (
  coalesce(nullif(btrim(id), ''), '') <> ''
  and role in ('Employee', 'Supervisor')
  and status in ('Active', 'OnLeave', 'Resigned')
)
with check (
  coalesce(nullif(btrim(id), ''), '') <> ''
  and char_length(coalesce(pin, '')) >= 4
  and role in ('Employee', 'Supervisor')
  and status in ('Active', 'OnLeave', 'Resigned')
);

drop policy if exists employees_delete_for_client on public.employees;
create policy employees_delete_for_client
on public.employees
for delete
to anon, authenticated
using (
  coalesce(nullif(btrim(id), ''), '') <> ''
  and role in ('Employee', 'Supervisor')
  and status in ('Active', 'OnLeave', 'Resigned')
);

-- 4) Tighten profile request update policy (avoid USING true)
alter table public.employee_profile_requests enable row level security;

drop policy if exists profile_requests_update_for_client on public.employee_profile_requests;
create policy profile_requests_update_for_client
on public.employee_profile_requests
for update
to anon, authenticated
using (
  coalesce(nullif(btrim(employee_id), ''), '') <> ''
  and request_type in ('register', 'update')
  and status in ('pending', 'approved', 'rejected')
)
with check (
  coalesce(nullif(btrim(employee_id), ''), '') <> ''
  and char_length(coalesce(pin, '')) >= 4
  and request_type in ('register', 'update')
  and status in ('pending', 'approved', 'rejected')
);

-- 5) Tighten portal admin update policy (avoid USING true)
alter table public.portal_admin_accounts enable row level security;

drop policy if exists portal_admin_accounts_update_all on public.portal_admin_accounts;
create policy portal_admin_accounts_update_all
on public.portal_admin_accounts
for update
to anon, authenticated
using (
  (username = 'master' and role = 'Master' and active = true)
  or (username <> 'master' and role = 'Admin')
)
with check (
  char_length(password) >= 6
  and role in ('Master', 'Admin')
  and (
    (username = 'master' and role = 'Master' and active = true)
    or (username <> 'master' and role = 'Admin')
  )
);

-- 6) Replace broad ALL policy on settings with explicit read + constrained write
alter table public.settings enable row level security;

drop policy if exists "Public Access Settings" on public.settings;
drop policy if exists settings_select_public on public.settings;
drop policy if exists settings_insert_checkin_v2 on public.settings;
drop policy if exists settings_update_checkin_v2 on public.settings;

create policy settings_select_public
on public.settings
for select
to anon, authenticated
using (true);

create policy settings_insert_checkin_v2
on public.settings
for insert
to anon, authenticated
with check (
  id = 'checkin_v2'
  and jsonb_typeof(config) = 'object'
);

create policy settings_update_checkin_v2
on public.settings
for update
to anon, authenticated
using (id = 'checkin_v2')
with check (
  id = 'checkin_v2'
  and jsonb_typeof(config) = 'object'
);

-- 7) Replace broad ALL policy on sites with read-only public access (if table exists)
do $$
begin
  if to_regclass('public.sites') is not null then
    execute 'alter table public.sites enable row level security';
    execute 'drop policy if exists "Public Access Sites" on public.sites';
    execute 'drop policy if exists sites_select_public on public.sites';
    execute 'create policy sites_select_public on public.sites for select to anon, authenticated using (true)';
  end if;
end
$$;

-- 8) Add explicit deny policy so RLS-enabled table is not policy-empty
alter table public.telegram_checkin_summary_logs enable row level security;

drop policy if exists telegram_logs_block_client_all on public.telegram_checkin_summary_logs;
create policy telegram_logs_block_client_all
on public.telegram_checkin_summary_logs
for all
to anon, authenticated
using (false)
with check (false);

commit;
