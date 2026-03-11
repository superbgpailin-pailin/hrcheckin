-- HR CheckIn v2: enable RLS on employees + employee_profile_requests
-- Date: 2026-03-11

begin;

alter table public.employees enable row level security;

drop policy if exists employees_select_for_client on public.employees;
create policy employees_select_for_client
on public.employees
for select
to anon, authenticated
using (true);

drop policy if exists employees_insert_for_client on public.employees;
create policy employees_insert_for_client
on public.employees
for insert
to anon, authenticated
with check (
  coalesce(nullif(btrim(id), ''), '') <> ''
  and char_length(coalesce(pin, '')) >= 4
  and role in ('Employee', 'Supervisor')
  and status in ('Active', 'OnLeave', 'Resigned')
);

drop policy if exists employees_update_for_client on public.employees;
create policy employees_update_for_client
on public.employees
for update
to anon, authenticated
using (true)
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
using (true);

alter table public.employee_profile_requests enable row level security;

drop policy if exists profile_requests_select_for_client on public.employee_profile_requests;
create policy profile_requests_select_for_client
on public.employee_profile_requests
for select
to anon, authenticated
using (true);

drop policy if exists profile_requests_insert_for_client on public.employee_profile_requests;
create policy profile_requests_insert_for_client
on public.employee_profile_requests
for insert
to anon, authenticated
with check (
  coalesce(nullif(btrim(employee_id), ''), '') <> ''
  and char_length(coalesce(pin, '')) >= 4
  and request_type in ('register', 'update')
  and status = 'pending'
);

drop policy if exists profile_requests_update_for_client on public.employee_profile_requests;
create policy profile_requests_update_for_client
on public.employee_profile_requests
for update
to anon, authenticated
using (true)
with check (
  coalesce(nullif(btrim(employee_id), ''), '') <> ''
  and char_length(coalesce(pin, '')) >= 4
  and request_type in ('register', 'update')
  and status in ('pending', 'approved', 'rejected')
);

commit;
