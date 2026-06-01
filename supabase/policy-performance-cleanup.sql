drop policy if exists "Staff can read allowed members" on public.allowed_members;
drop policy if exists "Admin can manage allowed members" on public.allowed_members;

create policy "Staff can read allowed members"
on public.allowed_members for select
to authenticated
using (app_private.is_staff());

create policy "Admin can insert allowed members"
on public.allowed_members for insert
to authenticated
with check (app_private.is_admin());

create policy "Admin can update allowed members"
on public.allowed_members for update
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admin can delete allowed members"
on public.allowed_members for delete
to authenticated
using (app_private.is_admin());

drop policy if exists "Staff can read own role" on public.staff_roles;
drop policy if exists "Admin can manage roles" on public.staff_roles;

create policy "Staff can read roles"
on public.staff_roles for select
to authenticated
using (user_id = (select auth.uid()) or app_private.is_admin());

create policy "Admin can insert roles"
on public.staff_roles for insert
to authenticated
with check (app_private.is_admin());

create policy "Admin can update roles"
on public.staff_roles for update
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

create policy "Admin can delete roles"
on public.staff_roles for delete
to authenticated
using (app_private.is_admin());
