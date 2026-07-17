-- ============================================================
-- PhysioK29 — Executive Portal Migration
-- Run this ONCE in Supabase Dashboard > SQL Editor
-- AFTER supabase-schema.sql and supabase-migration.sql
-- ============================================================

-- ── 1. PATCH staff_roles ────────────────────────────────────
-- Add id as PK, keep user_id as unique FK
alter table public.staff_roles
  add column if not exists id uuid;

update public.staff_roles set id = gen_random_uuid() where id is null;

alter table public.staff_roles
  alter column id set not null,
  alter column id set default gen_random_uuid();

do $$ begin
  alter table public.staff_roles add constraint staff_roles_pkey primary key (id);
exception when duplicate_table then null;
end $$;

alter table public.staff_roles
  add constraint if not exists staff_roles_user_id_unique unique (user_id);

-- Expand role check to include all exec roles
alter table public.staff_roles
  drop constraint if exists staff_roles_role_check;

alter table public.staff_roles
  add constraint staff_roles_role_check
  check (role in ('admin', 'representative', 'academic', 'treasurer', 'auditor', 'designer'));

-- ── 2. PATCH members ────────────────────────────────────────
alter table public.members
  add column if not exists email text,
  add column if not exists class text,
  add column if not exists enrollment_status text not null default 'active',
  add column if not exists photo_url text;

-- ── 3. PATCH announcements ──────────────────────────────────
alter table public.announcements
  add column if not exists author text,
  add column if not exists status text not null default 'live';

-- ── 4. PATCH suggestions ────────────────────────────────────
alter table public.suggestions
  add column if not exists status text not null default 'pending';

-- ── 5. PATCH quiz_attempts ──────────────────────────────────
alter table public.quiz_attempts
  add column if not exists percent numeric(5,2);

-- ── 6. PATCH topic_performance ──────────────────────────────
alter table public.topic_performance
  add column if not exists accuracy numeric(5,2);

-- ── 7. PATCH resource_progress status check ─────────────────
alter table public.resource_progress
  drop constraint if exists resource_progress_status_check;

alter table public.resource_progress
  add constraint resource_progress_status_check
  check (status in ('opened', 'reading', 'urgent', 'done', 'not_started'));

-- ── 8. CREATE courses ───────────────────────────────────────
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  department text
);

alter table public.courses enable row level security;

-- ── 9. CREATE receipts ──────────────────────────────────────
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  purpose text not null,
  amount numeric not null,
  date date not null,
  uploaded_by text not null,
  uploader_role text,
  students jsonb not null default '[]'::jsonb,
  student_details jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  verified_by text,
  verified_at timestamptz,
  receipt_url text,
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

-- ── 10. UPDATE is_staff() to cover new roles ────────────────
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_staff_role() in (
      'admin', 'representative', 'academic', 'treasurer', 'auditor', 'designer'
    ),
    false
  );
$$;

-- ── 11. RLS: courses ────────────────────────────────────────
drop policy if exists "Staff can read courses" on public.courses;
create policy "Staff can read courses"
on public.courses for select
to authenticated
using (public.is_staff());

drop policy if exists "Admin can manage courses" on public.courses;
create policy "Admin can manage courses"
on public.courses for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ── 12. RLS: receipts ───────────────────────────────────────
drop policy if exists "Staff can read receipts" on public.receipts;
create policy "Staff can read receipts"
on public.receipts for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can create receipts" on public.receipts;
create policy "Staff can create receipts"
on public.receipts for insert
to authenticated
with check (public.is_staff());

drop policy if exists "Auditor can update receipts" on public.receipts;
create policy "Auditor can update receipts"
on public.receipts for update
to authenticated
using (public.current_staff_role() in ('admin', 'auditor'))
with check (public.current_staff_role() in ('admin', 'auditor'));

drop policy if exists "Admin can delete receipts" on public.receipts;
create policy "Admin can delete receipts"
on public.receipts for delete
to authenticated
using (public.is_admin());

-- ── 13. RLS: quiz_attempts (staff select + bridge insert) ───
drop policy if exists "Staff can read quiz attempts" on public.quiz_attempts;
create policy "Staff can read quiz attempts"
on public.quiz_attempts for select
to authenticated
using (public.is_staff());

-- ── 14. RLS: topic_performance ──────────────────────────────
drop policy if exists "Staff can read topic performance" on public.topic_performance;
create policy "Staff can read topic performance"
on public.topic_performance for select
to authenticated
using (public.is_staff());

-- ── 15. RLS: study_events ───────────────────────────────────
drop policy if exists "Staff can read study events" on public.study_events;
create policy "Staff can read study events"
on public.study_events for select
to authenticated
using (public.is_staff());

-- ── 16. RLS: question_bank ──────────────────────────────────
drop policy if exists "Staff can read question bank" on public.question_bank;
create policy "Staff can read question bank"
on public.question_bank for select
to authenticated
using (public.is_staff());

-- ── 17. Realtime subscriptions for new tables ───────────────
do $$
begin
  alter publication supabase_realtime add table public.quiz_attempts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.study_events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.topic_performance;
exception when duplicate_object then null;
end $$;
