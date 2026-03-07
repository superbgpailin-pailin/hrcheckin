-- HR CheckIn v2: telegram check-in summary delivery logs
-- Date: 2026-03-10

begin;

create table if not exists public.telegram_checkin_summary_logs (
  id uuid primary key default gen_random_uuid(),
  sent_date date not null,
  round_id text not null,
  round_label text not null default '',
  start_time text not null,
  end_time text not null,
  send_time text not null,
  checkin_count integer not null default 0,
  telegram_chat_id text not null default '',
  message_text text not null default '',
  sent_at timestamptz not null default now()
);

alter table public.telegram_checkin_summary_logs add column if not exists sent_date date;
alter table public.telegram_checkin_summary_logs add column if not exists round_id text;
alter table public.telegram_checkin_summary_logs add column if not exists round_label text not null default '';
alter table public.telegram_checkin_summary_logs add column if not exists start_time text;
alter table public.telegram_checkin_summary_logs add column if not exists end_time text;
alter table public.telegram_checkin_summary_logs add column if not exists send_time text;
alter table public.telegram_checkin_summary_logs add column if not exists checkin_count integer not null default 0;
alter table public.telegram_checkin_summary_logs add column if not exists telegram_chat_id text not null default '';
alter table public.telegram_checkin_summary_logs add column if not exists message_text text not null default '';
alter table public.telegram_checkin_summary_logs add column if not exists sent_at timestamptz not null default now();

alter table public.telegram_checkin_summary_logs alter column sent_date set not null;
alter table public.telegram_checkin_summary_logs alter column round_id set not null;
alter table public.telegram_checkin_summary_logs alter column start_time set not null;
alter table public.telegram_checkin_summary_logs alter column end_time set not null;
alter table public.telegram_checkin_summary_logs alter column send_time set not null;

create unique index if not exists ux_telegram_checkin_summary_logs_date_round
  on public.telegram_checkin_summary_logs(sent_date, round_id);

create index if not exists idx_telegram_checkin_summary_logs_sent_at
  on public.telegram_checkin_summary_logs(sent_at desc);

alter table public.telegram_checkin_summary_logs enable row level security;

commit;
