-- Physiology 2k29 Supabase setup.
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  matric_number text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
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
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  priority text not null default 'Normal' check (priority in ('Normal', 'Important', 'Urgent')),
  posted_by text not null,
  posted_by_user_id uuid not null references auth.users(id) on delete restrict,
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

alter table public.members enable row level security;
alter table public.allowed_members enable row level security;
alter table public.staff_roles enable row level security;
alter table public.resources enable row level security;
alter table public.announcements enable row level security;
alter table public.suggestions enable row level security;

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

create or replace function public.register_member(p_name text, p_matric_number text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_matric text;
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

  if not exists (
    select 1
    from public.allowed_members
    where matric_number = v_matric
  ) then
    raise exception 'This matric number is not on the Physiology 2k29 class list.';
  end if;

  insert into public.members (name, matric_number, last_seen_at)
  values (v_name, v_matric, now())
  on conflict (matric_number)
  do update set
    name = excluded.name,
    last_seen_at = now()
  returning id into v_member_id;

  return v_member_id;
end;
$$;

drop function if exists public.refresh_member_seen(uuid, text);

create function public.refresh_member_seen(p_member_id uuid, p_matric_number text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matric text;
begin
  v_matric := upper(regexp_replace(trim(coalesce(p_matric_number, '')), '\s+', '', 'g'));

  update public.members
  set last_seen_at = now()
  where id = p_member_id
    and matric_number = v_matric
    and exists (
      select 1
      from public.allowed_members
      where matric_number = v_matric
    );

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

revoke all on function public.register_member(text, text) from public;
revoke all on function public.refresh_member_seen(uuid, text) from public;
revoke all on function public.current_staff_role() from public, anon, authenticated;
revoke all on function public.current_staff_name() from public, anon, authenticated;
revoke all on function public.get_my_staff_profile() from public, anon, authenticated;
revoke all on function public.is_staff() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.can_delete_resource_object(text) from public, anon, authenticated;
grant execute on function public.register_member(text, text) to anon, authenticated;
grant execute on function public.refresh_member_seen(uuid, text) to anon, authenticated;
grant execute on function public.get_my_staff_profile() to authenticated;

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
create policy "Public can read resources"
on public.resources for select
to anon, authenticated
using (true);

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
create policy "Public can read announcements"
on public.announcements for select
to anon, authenticated
using (true);

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
create policy "Anyone can create suggestions"
on public.suggestions for insert
to anon, authenticated
with check (
  char_length(name) between 3 and 80
  and char_length(matric_number) between 3 and 24
  and char_length(category) between 3 and 40
  and char_length(message) between 3 and 1200
);

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
values ('class-resources', 'class-resources', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read class resources" on storage.objects;

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
