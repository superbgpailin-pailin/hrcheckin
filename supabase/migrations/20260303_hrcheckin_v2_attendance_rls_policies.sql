-- HR CheckIn v2: attendance RLS policies for web client (anon/authenticated)
-- Date: 2026-03-03

begin;

alter table public.attendance enable row level security;

drop policy if exists attendance_select_all_for_client on public.attendance;
create policy attendance_select_all_for_client
on public.attendance
for select
to anon, authenticated
using (true);

drop policy if exists attendance_insert_checkin_for_client on public.attendance;
create policy attendance_insert_checkin_for_client
on public.attendance
for insert
to anon, authenticated
with check (
  employee_id is not null
  and coalesce(shift_name, '') <> ''
  and coalesce(type, 'check_in') = 'check_in'
);

commit;
