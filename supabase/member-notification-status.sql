alter table public.members
  add column if not exists notification_enabled boolean not null default false,
  add column if not exists onesignal_subscription_id text,
  add column if not exists notification_last_seen_at timestamptz,
  add column if not exists notification_updated_at timestamptz;

create index if not exists members_notification_enabled_idx
on public.members(notification_enabled, notification_updated_at desc);
