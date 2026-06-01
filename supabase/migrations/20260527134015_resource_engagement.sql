-- Resource engagement: in-site reading progress, urgent tags, and helpful votes.

alter table public.resource_progress
drop constraint if exists resource_progress_status_check;

update public.resource_progress
set status = 'reading'
where status = 'studying';

alter table public.resource_progress
alter column status set default 'opened';

alter table public.resource_progress
add constraint resource_progress_status_check
check (status in ('opened', 'reading', 'urgent', 'done'));

create table if not exists public.resource_feedback (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  helpful boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id, resource_id)
);

alter table public.resource_feedback enable row level security;

create index if not exists resource_feedback_member_idx
on public.resource_feedback(member_id, updated_at desc);

create index if not exists resource_feedback_resource_idx
on public.resource_feedback(resource_id, helpful);

drop policy if exists "Staff can read resource progress" on public.resource_progress;
create policy "Staff can read resource progress"
on public.resource_progress for select
to authenticated
using (public.is_staff());

drop policy if exists "No direct student resource feedback access" on public.resource_feedback;
create policy "No direct student resource feedback access"
on public.resource_feedback for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Staff can read resource feedback" on public.resource_feedback;
create policy "Staff can read resource feedback"
on public.resource_feedback for select
to authenticated
using (public.is_staff());

grant select on public.resource_progress to authenticated;
grant select on public.resource_feedback to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.resource_progress;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.resource_feedback;
exception when duplicate_object then null;
end $$;
