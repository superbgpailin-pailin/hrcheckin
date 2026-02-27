-- HR CheckIn v2: employee self-profile requests
-- Date: 2026-02-27

begin;

create table if not exists public.employee_profile_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  pin text not null,
  first_name_th text not null default '',
  last_name_th text not null default '',
  first_name_en text not null default '',
  last_name_en text not null default '',
  nickname text not null default '',
  position text not null default '',
  department text not null default '',
  email text not null default '',
  phone_number text not null default '',
  start_date date not null default current_date,
  default_shift_id text,
  request_type text not null default 'register' check (request_type in ('register', 'update')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_profile_requests add column if not exists employee_id text;
alter table public.employee_profile_requests add column if not exists pin text not null default '';
alter table public.employee_profile_requests add column if not exists first_name_th text not null default '';
alter table public.employee_profile_requests add column if not exists last_name_th text not null default '';
alter table public.employee_profile_requests add column if not exists first_name_en text not null default '';
alter table public.employee_profile_requests add column if not exists last_name_en text not null default '';
alter table public.employee_profile_requests add column if not exists nickname text not null default '';
alter table public.employee_profile_requests add column if not exists position text not null default '';
alter table public.employee_profile_requests add column if not exists department text not null default '';
alter table public.employee_profile_requests add column if not exists email text not null default '';
alter table public.employee_profile_requests add column if not exists phone_number text not null default '';
alter table public.employee_profile_requests add column if not exists start_date date not null default current_date;
alter table public.employee_profile_requests add column if not exists default_shift_id text;
alter table public.employee_profile_requests add column if not exists request_type text not null default 'register';
alter table public.employee_profile_requests add column if not exists status text not null default 'pending';
alter table public.employee_profile_requests add column if not exists review_note text not null default '';
alter table public.employee_profile_requests add column if not exists reviewed_by text;
alter table public.employee_profile_requests add column if not exists reviewed_at timestamptz;
alter table public.employee_profile_requests add column if not exists created_at timestamptz not null default now();
alter table public.employee_profile_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_profile_requests_status_created
  on public.employee_profile_requests(status, created_at desc);

create index if not exists idx_profile_requests_employee
  on public.employee_profile_requests(employee_id, created_at desc);

create unique index if not exists ux_profile_requests_pending_per_employee
  on public.employee_profile_requests(employee_id)
  where status = 'pending';

drop trigger if exists trg_profile_requests_set_updated_at on public.employee_profile_requests;
create trigger trg_profile_requests_set_updated_at
before update on public.employee_profile_requests
for each row execute function public.set_updated_at();

commit;
