-- HR CheckIn v2: allow web client to edit attendance check-in records
-- Date: 2026-03-07

begin;

alter table public.attendance enable row level security;

drop policy if exists attendance_update_checkin_for_client on public.attendance;
create policy attendance_update_checkin_for_client
on public.attendance
for update
to anon, authenticated
using (coalesce(type, 'check_in') = 'check_in')
with check (
  employee_id is not null
  and coalesce(shift_name, '') <> ''
  and coalesce(type, 'check_in') = 'check_in'
);

commit;
