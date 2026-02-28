-- HR CheckIn v2: ensure employee document bucket exists for profile and check-in selfies
-- Date: 2026-03-08

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists employee_documents_public_read on storage.objects;
create policy employee_documents_public_read
on storage.objects
for select
to public
using (bucket_id = 'employee-documents');

drop policy if exists employee_documents_anon_upload on storage.objects;
create policy employee_documents_anon_upload
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'employee-documents');

drop policy if exists employee_documents_anon_update on storage.objects;
create policy employee_documents_anon_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'employee-documents')
with check (bucket_id = 'employee-documents');

drop policy if exists employee_documents_anon_delete on storage.objects;
create policy employee_documents_anon_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'employee-documents');

commit;
