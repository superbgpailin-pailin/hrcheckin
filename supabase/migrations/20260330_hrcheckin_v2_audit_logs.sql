-- HR CheckIn v2: audit logs for admin and self-service edits
-- Date: 2026-03-30

begin;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text not null,
  actor_name text,
  actor_role text,
  actor_source text not null default 'portal',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at_desc
on public.audit_logs (created_at desc);

create index if not exists idx_audit_logs_entity_created_at_desc
on public.audit_logs (entity_type, entity_id, created_at desc);

create index if not exists idx_audit_logs_actor_created_at_desc
on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_for_client on public.audit_logs;
create policy audit_logs_select_for_client
on public.audit_logs
for select
to anon, authenticated
using (true);

drop policy if exists audit_logs_insert_for_client on public.audit_logs;
create policy audit_logs_insert_for_client
on public.audit_logs
for insert
to anon, authenticated
with check (
  coalesce(nullif(btrim(actor_type), ''), '') <> ''
  and coalesce(nullif(btrim(actor_id), ''), '') <> ''
  and coalesce(nullif(btrim(actor_source), ''), '') <> ''
  and coalesce(nullif(btrim(action), ''), '') <> ''
  and coalesce(nullif(btrim(entity_type), ''), '') <> ''
  and coalesce(nullif(btrim(entity_id), ''), '') <> ''
  and coalesce(nullif(btrim(summary), ''), '') <> ''
  and jsonb_typeof(details) = 'object'
);

commit;
