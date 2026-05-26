create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff_roles where user_id = (select auth.uid()) limit 1;
$$;

create or replace function app_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_private.current_staff_role() in ('rep', 'admin'), false);
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_private.current_staff_role() = 'admin', false);
$$;

create or replace function app_private.can_delete_resource_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    app_private.is_admin()
    or exists (
      select 1
      from public.resources
      where storage_path = object_name
        and uploaded_by_user_id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function app_private.current_staff_role() from public, anon;
revoke all on function app_private.is_staff() from public, anon;
revoke all on function app_private.is_admin() from public, anon;
revoke all on function app_private.can_delete_resource_object(text) from public, anon;
grant execute on function app_private.current_staff_role() to authenticated, service_role;
grant execute on function app_private.is_staff() to authenticated, service_role;
grant execute on function app_private.is_admin() to authenticated, service_role;
grant execute on function app_private.can_delete_resource_object(text) to authenticated, service_role;

revoke all on function public.current_staff_role() from public, anon, authenticated;
revoke all on function public.current_staff_name() from public, anon, authenticated;
revoke all on function public.get_my_staff_profile() from public, anon, authenticated;
revoke all on function public.is_staff() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.can_delete_resource_object(text) from public, anon, authenticated;

drop policy if exists "Staff can read members" on public.members;
create policy "Staff can read members"
on public.members for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Staff can read allowed members" on public.allowed_members;
create policy "Staff can read allowed members"
on public.allowed_members for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Admin can manage allowed members" on public.allowed_members;
create policy "Admin can manage allowed members"
on public.allowed_members for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "Admin can delete members" on public.members;
create policy "Admin can delete members"
on public.members for delete
to authenticated
using (app_private.is_admin());

drop policy if exists "Staff can read own role" on public.staff_roles;
create policy "Staff can read own role"
on public.staff_roles for select
to authenticated
using (user_id = (select auth.uid()) or app_private.is_admin());

drop policy if exists "Admin can manage roles" on public.staff_roles;
create policy "Admin can manage roles"
on public.staff_roles for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "Staff can read resources" on public.resources;
create policy "Staff can read resources"
on public.resources for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Staff can create resources" on public.resources;
create policy "Staff can create resources"
on public.resources for insert
to authenticated
with check (app_private.is_staff() and uploaded_by_user_id = (select auth.uid()));

drop policy if exists "Admin can update resources" on public.resources;
drop policy if exists "Staff can update own resources" on public.resources;
create policy "Staff can update allowed resources"
on public.resources for update
to authenticated
using (app_private.is_admin() or (app_private.is_staff() and uploaded_by_user_id = (select auth.uid())))
with check (app_private.is_admin() or (app_private.is_staff() and uploaded_by_user_id = (select auth.uid())));

drop policy if exists "Admin can delete resources" on public.resources;
drop policy if exists "Staff can delete own resources" on public.resources;
create policy "Staff can delete allowed resources"
on public.resources for delete
to authenticated
using (app_private.is_admin() or (app_private.is_staff() and uploaded_by_user_id = (select auth.uid())));

drop policy if exists "Staff can read announcements" on public.announcements;
create policy "Staff can read announcements"
on public.announcements for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Staff can create announcements" on public.announcements;
create policy "Staff can create announcements"
on public.announcements for insert
to authenticated
with check (app_private.is_staff() and posted_by_user_id = (select auth.uid()));

drop policy if exists "Admin can update announcements" on public.announcements;
drop policy if exists "Staff can update own announcements" on public.announcements;
create policy "Staff can update allowed announcements"
on public.announcements for update
to authenticated
using (app_private.is_admin() or (app_private.is_staff() and posted_by_user_id = (select auth.uid())))
with check (app_private.is_admin() or (app_private.is_staff() and posted_by_user_id = (select auth.uid())));

drop policy if exists "Admin can delete announcements" on public.announcements;
drop policy if exists "Staff can delete own announcements" on public.announcements;
create policy "Staff can delete allowed announcements"
on public.announcements for delete
to authenticated
using (app_private.is_admin() or (app_private.is_staff() and posted_by_user_id = (select auth.uid())));

drop policy if exists "Staff can read suggestions" on public.suggestions;
create policy "Staff can read suggestions"
on public.suggestions for select
to authenticated
using (app_private.is_staff());

drop policy if exists "Admin can delete suggestions" on public.suggestions;
create policy "Admin can delete suggestions"
on public.suggestions for delete
to authenticated
using (app_private.is_admin());

drop policy if exists "Staff can read class resources" on storage.objects;
create policy "Staff can read class resources"
on storage.objects for select
to authenticated
using (bucket_id = 'class-resources' and app_private.is_staff());

drop policy if exists "Staff can upload class resources" on storage.objects;
create policy "Staff can upload class resources"
on storage.objects for insert
to authenticated
with check (bucket_id = 'class-resources' and app_private.is_staff());

drop policy if exists "Staff can delete owned class resources" on storage.objects;
create policy "Staff can delete owned class resources"
on storage.objects for delete
to authenticated
using (bucket_id = 'class-resources' and app_private.can_delete_resource_object(name));
