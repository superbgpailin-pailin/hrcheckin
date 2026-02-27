-- HR CheckIn v2 schema (no deploy yet)
-- Date: 2026-02-27

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SETTINGS
create table if not exists public.settings (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.settings add column if not exists created_at timestamptz not null default now();
alter table public.settings add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_settings_set_updated_at on public.settings;
create trigger trg_settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- EMPLOYEES
create table if not exists public.employees (
  id text primary key,
  role text not null default 'Employee' check (role in ('Employee', 'Supervisor')),
  photo_url text,
  first_name_th text not null default '',
  last_name_th text not null default '',
  first_name_en text not null default '',
  last_name_en text not null default '',
  nickname text not null default '',
  position text not null default '',
  department text not null default '',
  status text not null default 'Active' check (status in ('Active', 'OnLeave', 'Resigned')),
  pin text not null default '123456',
  email text not null default '',
  phone_number text not null default '',
  start_date date not null default current_date,
  default_shift_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees add column if not exists role text not null default 'Employee';
alter table public.employees add column if not exists photo_url text;
alter table public.employees add column if not exists first_name_th text not null default '';
alter table public.employees add column if not exists last_name_th text not null default '';
alter table public.employees add column if not exists first_name_en text not null default '';
alter table public.employees add column if not exists last_name_en text not null default '';
alter table public.employees add column if not exists nickname text not null default '';
alter table public.employees add column if not exists position text not null default '';
alter table public.employees add column if not exists department text not null default '';
alter table public.employees add column if not exists status text not null default 'Active';
alter table public.employees add column if not exists pin text not null default '123456';
alter table public.employees add column if not exists email text not null default '';
alter table public.employees add column if not exists phone_number text not null default '';
alter table public.employees add column if not exists start_date date not null default current_date;
alter table public.employees add column if not exists default_shift_id text;
alter table public.employees add column if not exists created_at timestamptz not null default now();
alter table public.employees add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_employees_role on public.employees(role);
create index if not exists idx_employees_status on public.employees(status);
create index if not exists idx_employees_department on public.employees(department);

drop trigger if exists trg_employees_set_updated_at on public.employees;
create trigger trg_employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- ATTENDANCE
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  employee_id text not null,
  timestamp timestamptz not null default now(),
  type text not null default 'check_in' check (type in ('check_in', 'check_out')),
  site_id text not null default 'kiosk',
  site_name text not null default 'QR Kiosk',
  lat double precision not null default 0,
  lng double precision not null default 0,
  photo_url text not null default '',
  status text not null default 'On Time' check (status in ('On Time', 'Late')),
  shift_name text not null,
  created_at timestamptz not null default now()
);

alter table public.attendance add column if not exists user_id text;
alter table public.attendance add column if not exists employee_id text;
alter table public.attendance add column if not exists timestamp timestamptz not null default now();
alter table public.attendance add column if not exists type text not null default 'check_in';
alter table public.attendance add column if not exists site_id text not null default 'kiosk';
alter table public.attendance add column if not exists site_name text not null default 'QR Kiosk';
alter table public.attendance add column if not exists lat double precision not null default 0;
alter table public.attendance add column if not exists lng double precision not null default 0;
alter table public.attendance add column if not exists photo_url text not null default '';
alter table public.attendance add column if not exists status text not null default 'On Time';
alter table public.attendance add column if not exists shift_name text;
alter table public.attendance add column if not exists created_at timestamptz not null default now();

create index if not exists idx_attendance_employee_timestamp on public.attendance(employee_id, timestamp desc);
create index if not exists idx_attendance_shift_timestamp on public.attendance(shift_name, timestamp desc);
create index if not exists idx_attendance_type on public.attendance(type);

-- Optional hard rule: one check-in per employee per shift per local day (Asia/Bangkok)
create unique index if not exists ux_attendance_checkin_per_shift_day
on public.attendance (
  employee_id,
  shift_name,
  ((timestamp at time zone 'Asia/Bangkok')::date)
)
where type = 'check_in';

-- Seed default app config row
insert into public.settings (id, config)
values (
  'checkin_v2',
  jsonb_build_object(
    'companyName', 'HR CheckIn',
    'qrSecret', 'CHANGE_ME_QR_SECRET_2026',
    'qrTokenLifetimeSeconds', 20,
    'qrRefreshSeconds', 8,
    'lateGraceMinutes', 15,
    'controlShiftPolicy', jsonb_build_object('enabled', true, 'overrides', jsonb_build_object()),
    'shifts', jsonb_build_array(
      jsonb_build_object('id', 'morning', 'label', 'กะเช้า 08:00-20:00', 'start', '08:00', 'end', '20:00'),
      jsonb_build_object('id', 'supervisor_afternoon', 'label', 'กะบ่าย (หัวหน้า) 12:00-24:00', 'start', '12:00', 'end', '24:00', 'supervisorOnly', true),
      jsonb_build_object('id', 'night', 'label', 'กะดึก 20:00-08:00', 'start', '20:00', 'end', '08:00'),
      jsonb_build_object('id', 'control_night', 'label', 'ควบกะ 20:00-14:00', 'start', '20:00', 'end', '14:00', 'isControlShift', true),
      jsonb_build_object('id', 'control_day', 'label', 'ควบกะ 14:00-08:00', 'start', '14:00', 'end', '08:00', 'isControlShift', true)
    )
  )
)
on conflict (id) do nothing;

commit;
