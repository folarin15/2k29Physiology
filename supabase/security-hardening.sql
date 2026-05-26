create table if not exists public.member_access_attempts (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  client_key text not null,
  matric_number text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists member_access_attempts_lookup_idx
on public.member_access_attempts(action, client_key, success, created_at desc);

alter table public.member_access_attempts enable row level security;

revoke all on function public.register_member(text, text) from public, anon, authenticated;
revoke all on function public.refresh_member_seen(uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_member(text, text) to service_role;
grant execute on function public.refresh_member_seen(uuid, text, text) to service_role;

drop policy if exists "Public can read resources" on public.resources;
drop policy if exists "Staff can read resources" on public.resources;
create policy "Staff can read resources"
on public.resources for select
to authenticated
using (public.is_staff());

drop policy if exists "Public can read announcements" on public.announcements;
drop policy if exists "Staff can read announcements" on public.announcements;
create policy "Staff can read announcements"
on public.announcements for select
to authenticated
using (public.is_staff());

drop policy if exists "Anyone can create suggestions" on public.suggestions;

insert into storage.buckets (id, name, public)
values ('class-resources', 'class-resources', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read class resources" on storage.objects;
drop policy if exists "Staff can read class resources" on storage.objects;
create policy "Staff can read class resources"
on storage.objects for select
to authenticated
using (bucket_id = 'class-resources' and public.is_staff());
