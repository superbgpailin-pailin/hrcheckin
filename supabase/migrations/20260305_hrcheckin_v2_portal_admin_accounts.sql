-- HR CheckIn v2: backend admin accounts for portal login
-- Date: 2026-03-05

begin;

create table if not exists public.portal_admin_accounts (
  username text primary key,
  display_name text not null default '',
  role text not null default 'Admin' check (role in ('Master', 'Admin')),
  photo_url text not null default '',
  password text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_admin_accounts add column if not exists display_name text not null default '';
alter table public.portal_admin_accounts add column if not exists role text not null default 'Admin';
alter table public.portal_admin_accounts add column if not exists photo_url text not null default '';
alter table public.portal_admin_accounts add column if not exists password text not null default '';
alter table public.portal_admin_accounts add column if not exists active boolean not null default true;
alter table public.portal_admin_accounts add column if not exists created_at timestamptz not null default now();
alter table public.portal_admin_accounts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_portal_admin_accounts_set_updated_at on public.portal_admin_accounts;
create trigger trg_portal_admin_accounts_set_updated_at
before update on public.portal_admin_accounts
for each row execute function public.set_updated_at();

insert into public.portal_admin_accounts (username, display_name, role, photo_url, password, active)
values (
  'master',
  'Master Admin',
  'Master',
  'https://ui-avatars.com/api/?name=Master+Admin&background=0f172a&color=fff',
  '!master',
  true
)
on conflict (username) do update
set
  role = 'Master',
  active = true;

alter table public.portal_admin_accounts enable row level security;

drop policy if exists portal_admin_accounts_select_all on public.portal_admin_accounts;
create policy portal_admin_accounts_select_all
on public.portal_admin_accounts
for select
to anon, authenticated
using (true);

drop policy if exists portal_admin_accounts_insert_admin on public.portal_admin_accounts;
create policy portal_admin_accounts_insert_admin
on public.portal_admin_accounts
for insert
to anon, authenticated
with check (
  username <> 'master'
  and role = 'Admin'
  and char_length(password) >= 6
  and active = true
);

commit;
