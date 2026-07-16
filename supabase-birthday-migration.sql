-- ============================================================
-- PhysioK29 — Birthday Onboarding Migration
-- Run this ONCE in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Add birthday columns to `members` ────────────────────
alter table public.members
  add column if not exists full_name text,
  add column if not exists date_of_birth date,
  add column if not exists birthday_photo_url text,
  add column if not exists birthday_registration_completed boolean not null default false,
  add column if not exists birthday_photo_updated_at timestamptz;

-- ── 2. Index for looking up upcoming birthdays ──────────────
create index if not exists idx_members_date_of_birth
  on public.members(date_of_birth)
  where birthday_registration_completed = true;

-- ── 3. Create `birthday-photos` storage bucket ──────────────
insert into storage.buckets (id, name, public)
values ('birthday-photos', 'birthday-photos', true)
on conflict (id) do update set public = excluded.public;

-- ── 4. Storage RLS policies ────────────────────────────────
drop policy if exists "Anyone can read birthday-photos" on storage.objects;
create policy "Anyone can read birthday-photos"
on storage.objects for select
to public
using (bucket_id = 'birthday-photos');

drop policy if exists "Members can upload birthday-photos" on storage.objects;
create policy "Members can upload birthday-photos"
on storage.objects for insert
to public
with check (bucket_id = 'birthday-photos');

drop policy if exists "Members can update own birthday-photos" on storage.objects;
create policy "Members can update own birthday-photos"
on storage.objects for update
to public
using (bucket_id = 'birthday-photos')
with check (bucket_id = 'birthday-photos');
