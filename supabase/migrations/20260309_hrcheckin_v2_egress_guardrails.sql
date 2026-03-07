-- HR CheckIn v2: egress guardrails
-- Date: 2026-03-09

begin;

-- Keep client reads focused on recent operational data to reduce high-volume scraping impact.
alter table public.attendance enable row level security;

drop policy if exists attendance_select_all_for_client on public.attendance;
drop policy if exists attendance_select_recent_for_client on public.attendance;
create policy attendance_select_recent_for_client
on public.attendance
for select
to anon, authenticated
using (
  coalesce(type, 'check_in') = 'check_in'
  and "timestamp" >= (now() - interval '120 days')
);

-- Frontend only uploads new files; block broad anon update/delete on storage objects.
drop policy if exists employee_documents_anon_update on storage.objects;
drop policy if exists employee_documents_authenticated_update on storage.objects;
create policy employee_documents_authenticated_update
on storage.objects
for update
to authenticated
using (bucket_id = 'employee-documents')
with check (bucket_id = 'employee-documents');

drop policy if exists employee_documents_anon_delete on storage.objects;
drop policy if exists employee_documents_authenticated_delete on storage.objects;
create policy employee_documents_authenticated_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'employee-documents');

commit;
