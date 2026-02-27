-- HR CheckIn v2: allow delete + enforce one check-in per employee per day
-- Date: 2026-03-04

begin;

alter table public.attendance enable row level security;

-- Keep only one check-in per employee per day (Asia/Bangkok) before adding unique index
with ranked as (
  select
    id,
    row_number() over (
      partition by employee_id, ((timestamp at time zone 'Asia/Bangkok')::date)
      order by timestamp asc, id asc
    ) as rn
  from public.attendance
  where coalesce(type, 'check_in') = 'check_in'
)
delete from public.attendance a
using ranked r
where a.id = r.id
  and r.rn > 1;

drop index if exists public.ux_attendance_checkin_per_shift_day;
drop index if exists public.ux_attendance_checkin_per_day;
create unique index ux_attendance_checkin_per_day
on public.attendance (
  employee_id,
  ((timestamp at time zone 'Asia/Bangkok')::date)
)
where coalesce(type, 'check_in') = 'check_in';

drop policy if exists attendance_delete_checkin_for_client on public.attendance;
create policy attendance_delete_checkin_for_client
on public.attendance
for delete
to anon, authenticated
using (coalesce(type, 'check_in') = 'check_in');

commit;
