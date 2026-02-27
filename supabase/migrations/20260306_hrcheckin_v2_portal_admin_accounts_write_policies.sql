-- HR CheckIn v2: allow update/delete on portal_admin_accounts for frontend admin management
-- Date: 2026-03-06

begin;

alter table public.portal_admin_accounts enable row level security;

drop policy if exists portal_admin_accounts_update_all on public.portal_admin_accounts;
create policy portal_admin_accounts_update_all
on public.portal_admin_accounts
for update
to anon, authenticated
using (true)
with check (
  char_length(password) >= 6
  and role in ('Master', 'Admin')
  and (
    (username = 'master' and role = 'Master' and active = true)
    or (username <> 'master' and role = 'Admin')
  )
);

drop policy if exists portal_admin_accounts_delete_non_master on public.portal_admin_accounts;
create policy portal_admin_accounts_delete_non_master
on public.portal_admin_accounts
for delete
to anon, authenticated
using (username <> 'master');

commit;
