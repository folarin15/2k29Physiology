-- Physiology 2k29 Supabase setup.
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  matric_number text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notification_enabled boolean not null default false,
  onesignal_subscription_id text,
  notification_last_seen_at timestamptz,
  notification_updated_at timestamptz
);

create table if not exists public.allowed_members (
  matric_number text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('rep', 'admin')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  course_code text not null,
  course_title text,
  type text not null default 'Resource',
  note text,
  file_name text not null,
  file_size bigint,
  file_type text,
  storage_path text not null,
  download_url text not null,
  uploaded_by text not null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.resource_progress (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  status text not null default 'opened' check (status in ('opened', 'reading', 'urgent', 'done')),
  opened_count integer not null default 0,
  current_page integer,
  total_pages integer,
  progress_percent numeric(5, 2) not null default 0,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id, resource_id)
);

create table if not exists public.resource_feedback (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  helpful boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id, resource_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  priority text not null default 'Normal' check (priority in ('Normal', 'Important', 'Urgent')),
  posted_by text not null,
  posted_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  matric_number text not null,
  category text not null default 'General',
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_access_attempts (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  client_key text not null,
  matric_number text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists resources_uploaded_by_user_id_idx on public.resources(uploaded_by_user_id);
create index if not exists announcements_posted_by_user_id_idx on public.announcements(posted_by_user_id);
create index if not exists member_access_attempts_lookup_idx
on public.member_access_attempts(action, client_key, success, created_at desc);
create index if not exists resource_progress_member_idx
on public.resource_progress(member_id, updated_at desc);
create index if not exists resource_progress_resource_idx
on public.resource_progress(resource_id, status);
create index if not exists resource_feedback_member_idx
on public.resource_feedback(member_id, updated_at desc);
create index if not exists resource_feedback_resource_idx
on public.resource_feedback(resource_id, helpful);

alter table public.members enable row level security;
alter table public.allowed_members enable row level security;
alter table public.staff_roles enable row level security;
alter table public.resources enable row level security;
alter table public.announcements enable row level security;
alter table public.suggestions enable row level security;
alter table public.member_access_attempts enable row level security;
alter table public.resource_progress enable row level security;
alter table public.resource_feedback enable row level security;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff_roles where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_staff_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select display_name from public.staff_roles where user_id = auth.uid() limit 1;
$$;

create or replace function public.get_my_staff_profile()
returns table(role text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select staff_roles.role, staff_roles.display_name
  from public.staff_roles
  where staff_roles.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_staff_role() in ('rep', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_staff_role() = 'admin', false);
$$;

create or replace function public.normalize_member_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(regexp_replace(upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]+', ' ', 'g')), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_member_name_key(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    (
      select string_agg(token, ' ' order by token)
      from regexp_split_to_table(public.normalize_member_name(p_name), '\s+') as token
      where token <> ''
    ),
    ''
  );
$$;

create or replace function public.member_name_matches(p_submitted_name text, p_allowed_name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select public.normalize_member_name(p_submitted_name) = public.normalize_member_name(p_allowed_name)
    or public.normalize_member_name_key(p_submitted_name) = public.normalize_member_name_key(p_allowed_name);
$$;

create or replace function public.register_member(p_name text, p_matric_number text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_matric text;
  v_allowed_name text;
  v_member_id uuid;
begin
  v_name := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_matric := upper(regexp_replace(trim(coalesce(p_matric_number, '')), '\s+', '', 'g'));

  if char_length(v_name) < 3 or char_length(v_name) > 80 then
    raise exception 'Enter your full name.';
  end if;

  if char_length(v_matric) < 3 or char_length(v_matric) > 24 then
    raise exception 'Enter a valid matric number.';
  end if;

  select name into v_allowed_name
  from public.allowed_members
  where matric_number = v_matric;

  if v_allowed_name is null then
    raise exception 'This matric number is not on the Physiology 2k29 class list.';
  end if;

  if not public.member_name_matches(v_name, v_allowed_name) then
    raise exception 'Your name must match the class list for this matric number.';
  end if;

  insert into public.members (name, matric_number, last_seen_at)
  values (v_allowed_name, v_matric, now())
  on conflict (matric_number)
  do update set
    name = excluded.name,
    last_seen_at = now()
  returning id into v_member_id;

  return v_member_id;
end;
$$;

drop function if exists public.refresh_member_seen(uuid, text);
drop function if exists public.refresh_member_seen(uuid, text, text);

create function public.refresh_member_seen(p_member_id uuid, p_name text, p_matric_number text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matric text;
  v_allowed_name text;
begin
  v_matric := upper(regexp_replace(trim(coalesce(p_matric_number, '')), '\s+', '', 'g'));

  select name into v_allowed_name
  from public.allowed_members
  where matric_number = v_matric;

  if v_allowed_name is null or not public.member_name_matches(p_name, v_allowed_name) then
    return false;
  end if;

  update public.members
  set last_seen_at = now()
  where id = p_member_id
    and matric_number = v_matric;

  return found;
end;
$$;

create or replace function public.can_delete_resource_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.resources
      where storage_path = object_name
        and uploaded_by_user_id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.register_member(text, text) from public, anon, authenticated;
revoke all on function public.refresh_member_seen(uuid, text, text) from public, anon, authenticated;
revoke all on function public.normalize_member_name(text) from public, anon, authenticated;
revoke all on function public.normalize_member_name_key(text) from public, anon, authenticated;
revoke all on function public.member_name_matches(text, text) from public, anon, authenticated;
revoke all on function public.current_staff_role() from public, anon, authenticated;
revoke all on function public.current_staff_name() from public, anon, authenticated;
revoke all on function public.get_my_staff_profile() from public, anon, authenticated;
revoke all on function public.is_staff() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.can_delete_resource_object(text) from public, anon, authenticated;
grant execute on function public.register_member(text, text) to service_role;
grant execute on function public.refresh_member_seen(uuid, text, text) to service_role;
grant execute on function public.get_my_staff_profile() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.current_staff_name() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_delete_resource_object(text) to authenticated;

drop policy if exists "Staff can read members" on public.members;
create policy "Staff can read members"
on public.members for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can read allowed members" on public.allowed_members;
create policy "Staff can read allowed members"
on public.allowed_members for select
to authenticated
using (public.is_staff());

drop policy if exists "Admin can manage allowed members" on public.allowed_members;
create policy "Admin can manage allowed members"
on public.allowed_members for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin can delete members" on public.members;
create policy "Admin can delete members"
on public.members for delete
to authenticated
using (public.is_admin());

drop policy if exists "No direct student resource progress access" on public.resource_progress;
create policy "No direct student resource progress access"
on public.resource_progress for all
to anon, authenticated
using (false)
with check (false);

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

drop policy if exists "Staff can read own role" on public.staff_roles;
create policy "Staff can read own role"
on public.staff_roles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admin can manage roles" on public.staff_roles;
create policy "Admin can manage roles"
on public.staff_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read resources" on public.resources;
drop policy if exists "Staff can read resources" on public.resources;
create policy "Staff can read resources"
on public.resources for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can create resources" on public.resources;
create policy "Staff can create resources"
on public.resources for insert
to authenticated
with check (public.is_staff() and uploaded_by_user_id = auth.uid());

drop policy if exists "Admin can update resources" on public.resources;
create policy "Admin can update resources"
on public.resources for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff can update own resources" on public.resources;
create policy "Staff can update own resources"
on public.resources for update
to authenticated
using (public.is_staff() and uploaded_by_user_id = auth.uid())
with check (public.is_staff() and uploaded_by_user_id = auth.uid());

drop policy if exists "Admin can delete resources" on public.resources;
create policy "Admin can delete resources"
on public.resources for delete
to authenticated
using (public.is_admin());

drop policy if exists "Staff can delete own resources" on public.resources;
create policy "Staff can delete own resources"
on public.resources for delete
to authenticated
using (public.is_staff() and uploaded_by_user_id = auth.uid());

drop policy if exists "Public can read announcements" on public.announcements;
drop policy if exists "Staff can read announcements" on public.announcements;
create policy "Staff can read announcements"
on public.announcements for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can create announcements" on public.announcements;
create policy "Staff can create announcements"
on public.announcements for insert
to authenticated
with check (public.is_staff() and posted_by_user_id = auth.uid());

drop policy if exists "Admin can update announcements" on public.announcements;
create policy "Admin can update announcements"
on public.announcements for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff can update own announcements" on public.announcements;
create policy "Staff can update own announcements"
on public.announcements for update
to authenticated
using (public.is_staff() and posted_by_user_id = auth.uid())
with check (public.is_staff() and posted_by_user_id = auth.uid());

drop policy if exists "Admin can delete announcements" on public.announcements;
create policy "Admin can delete announcements"
on public.announcements for delete
to authenticated
using (public.is_admin());

drop policy if exists "Staff can delete own announcements" on public.announcements;
create policy "Staff can delete own announcements"
on public.announcements for delete
to authenticated
using (public.is_staff() and posted_by_user_id = auth.uid());

drop policy if exists "Anyone can create suggestions" on public.suggestions;

drop policy if exists "Staff can read suggestions" on public.suggestions;
create policy "Staff can read suggestions"
on public.suggestions for select
to authenticated
using (public.is_staff());

drop policy if exists "Admin can delete suggestions" on public.suggestions;
create policy "Admin can delete suggestions"
on public.suggestions for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('class-resources', 'class-resources', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read class resources" on storage.objects;
drop policy if exists "Staff can read class resources" on storage.objects;
create policy "Staff can read class resources"
on storage.objects for select
to authenticated
using (bucket_id = 'class-resources' and public.is_staff());

drop policy if exists "Staff can upload class resources" on storage.objects;
create policy "Staff can upload class resources"
on storage.objects for insert
to authenticated
with check (bucket_id = 'class-resources' and public.is_staff());

drop policy if exists "Admin can delete class resources" on storage.objects;
drop policy if exists "Staff can delete owned class resources" on storage.objects;
create policy "Staff can delete owned class resources"
on storage.objects for delete
to authenticated
using (bucket_id = 'class-resources' and public.can_delete_resource_object(name));

do $$
begin
  alter publication supabase_realtime add table public.resources;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.suggestions;
exception when duplicate_object then null;
end $$;

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
