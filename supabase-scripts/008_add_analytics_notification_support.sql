-- ShelfSense AI Phase 5: notification deduplication/actions and time-range query indexes.

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists action_path text;

alter table public.notifications drop constraint if exists notifications_priority_check;
update public.notifications set priority = 'medium' where priority = 'normal';
update public.notifications set priority = 'critical' where priority = 'urgent';
alter table public.notifications
  add constraint notifications_priority_check check (priority in ('low', 'medium', 'high', 'critical'));
alter table public.notifications alter column priority set default 'medium';

create unique index if not exists notifications_user_dedupe_key_unique_idx
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists consumption_logs_user_consumed_at_idx
  on public.consumption_logs(user_id, consumed_at desc);

create index if not exists waste_logs_user_wasted_at_idx
  on public.waste_logs(user_id, wasted_at desc);
