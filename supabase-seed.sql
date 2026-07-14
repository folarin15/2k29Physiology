-- ============================================================
-- PhysioK29 — Seed Data Template
-- Run AFTER supabase-migration.sql
--
-- HOW TO USE:
-- 1. Fill in the allowed_members rows with your class list
-- 2. Create staff auth accounts in Supabase Dashboard > Auth > Users
-- 3. Copy each staff UUID into the staff_roles INSERT below
-- 4. Run this entire file in SQL Editor
-- ============================================================

-- ── 1. Allowed Members (class list) ─────────────────────────
-- Replace the sample rows below with your actual student data.
-- Format: ('MATRIC_NUMBER', 'FULL NAME')

insert into public.allowed_members (matric_number, name) values
  ('FUO/24/12/0001', 'ABIODUN ADEBAYO'),
  ('FUO/24/12/0002', 'ADAEZE CHUKWU'),
  ('FUO/24/12/0003', 'AHMED BAKARI'),
  ('FUO/24/12/0004', 'ANINTINDA AKINBODE'),
  ('FUO/24/12/0005', 'BENJAMIN EZE')
  -- ⚠️  ADD ALL REMAINING STUDENTS HERE
  -- One row per student, comma-separated except the last row
  -- Example:
  -- ('FUO/24/12/0006', 'CHIDINMA OKAFOR'),
  -- ('FUO/24/12/0007', 'DAVID ADEYEMI'),
  -- ...
on conflict (matric_number) do update set name = excluded.name;


-- ── 2. Staff Accounts ──────────────────────────────────────
-- STEP A: Go to Supabase Dashboard > Authentication > Users
-- STEP B: Click "Invite a user" for each staff member
--         Use their real email + a temporary password
-- STEP C: After they appear in the Users list, copy their UUID
-- STEP D: Paste the UUIDs into the INSERT below

-- Example (replace with real UUIDs from Auth > Users):
-- insert into public.staff_roles (user_id, role, display_name) values
--   ('PASTE-ADMIN-UUID-HERE', 'admin', 'Akinbode Anintinda'),
--   ('PASTE-REP-UUID-HERE',  'rep',   'Chioma Nwosu')
-- on conflict (user_id) do update set
--   role = excluded.role,
--   display_name = excluded.display_name;

-- ============================================================
-- After seeding:
-- 1. Run supabase-migration.sql if not already run
-- 2. Deploy Edge Functions: supabase functions deploy member-portal
-- 3. Test student registration with a name + matric from the list
-- 4. Test staff login with the Auth accounts you created
-- ============================================================
