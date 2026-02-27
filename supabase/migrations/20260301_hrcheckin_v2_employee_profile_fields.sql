-- HR CheckIn v2: extended employee/profile fields
-- Date: 2026-02-29

begin;

-- EMPLOYEES: add extended personal + document fields
alter table public.employees add column if not exists birth_date date;
alter table public.employees add column if not exists emergency_contact_name text not null default '';
alter table public.employees add column if not exists emergency_contact_phone text not null default '';
alter table public.employees add column if not exists selfie_url text not null default '';
alter table public.employees add column if not exists id_card_url text not null default '';
alter table public.employees add column if not exists passport_url text not null default '';

-- PROFILE REQUESTS: add same extended fields (for self-service submit)
alter table public.employee_profile_requests add column if not exists birth_date date;
alter table public.employee_profile_requests add column if not exists emergency_contact_name text not null default '';
alter table public.employee_profile_requests add column if not exists emergency_contact_phone text not null default '';
alter table public.employee_profile_requests add column if not exists selfie_url text not null default '';
alter table public.employee_profile_requests add column if not exists id_card_url text not null default '';
alter table public.employee_profile_requests add column if not exists passport_url text not null default '';

commit;
