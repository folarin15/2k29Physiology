-- ============================================================
-- PhysioK29 — Migration: missing tables + resource columns + RLS
-- Run this ONCE in Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Add weekly-lecture columns to `resources` ────────────
alter table public.resources
  add column if not exists week integer,
  add column if not exists lecture_date date,
  add column if not exists lecture_topic text,
  add column if not exists lecture_venue text,
  add column if not exists upload_category text not null default 'resource';

-- ── 2. Create missing tables ───────────────────────────────

-- question_bank: MCQ pool for quizzes
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  topic text not null default 'General',
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  difficulty text not null default 'Medium'
    check (difficulty in ('Easy', 'Medium', 'Hard')),
  source_hint text,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);

-- quiz_attempts: one row per quiz submission
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  mode text not null default 'practice'
    check (mode in ('practice', 'exam')),
  course_code text not null,
  topic text,
  question_count integer not null default 0,
  score integer not null default 0,
  duration_seconds integer not null default 0,
  motivation_text text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now()
);

-- quiz_answers: one row per answered question inside an attempt
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  selected_answer text,
  correct boolean not null default false
);

-- topic_performance: cumulative per-topic accuracy per member
create table if not exists public.topic_performance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  course_code text not null,
  topic text not null default 'General',
  attempts integer not null default 0,
  correct integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(member_id, course_code, topic)
);

-- study_events: log of read / quiz / exam events for streak calc
create table if not exists public.study_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_type text not null
    check (event_type in ('read', 'quiz', 'exam')),
  course_code text,
  resource_id uuid references public.resources(id) on delete set null,
  attempt_id uuid references public.quiz_attempts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- question_extraction_jobs: tracks PDF → MCQ extraction runs
create table if not exists public.question_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  course_code text,
  questions_extracted integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

-- ── 3. Indexes ─────────────────────────────────────────────

create index if not exists idx_question_bank_course
  on public.question_bank(course_code, status);

create index if not exists idx_question_bank_topic
  on public.question_bank(course_code, topic, status);

create index if not exists idx_quiz_attempts_member
  on public.quiz_attempts(member_id, submitted_at desc);

create index if not exists idx_quiz_attempts_course
  on public.quiz_attempts(course_code, submitted_at desc);

create index if not exists idx_quiz_answers_attempt
  on public.quiz_answers(attempt_id);

create index if not exists idx_topic_performance_member
  on public.topic_performance(member_id, course_code);

create index if not exists idx_study_events_member
  on public.study_events(member_id, created_at desc);

create index if not exists idx_study_events_course
  on public.study_events(course_code, event_type);

create index if not exists idx_resources_category
  on public.resources(upload_category, course_code);

create index if not exists idx_resources_week
  on public.resources(course_code, week)
  where upload_category = 'lecture';

-- ── 4. Enable RLS ──────────────────────────────────────────

alter table public.question_bank enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.topic_performance enable row level security;
alter table public.study_events enable row level security;
alter table public.question_extraction_jobs enable row level security;

-- ── 5. RLS Policies ────────────────────────────────────────

-- question_bank: students read published, staff manage all
drop policy if exists "Students can read published questions" on public.question_bank;
create policy "Students can read published questions"
on public.question_bank for select
to authenticated
using (status = 'published' or public.is_staff());

drop policy if exists "Staff can manage questions" on public.question_bank;
create policy "Staff can manage questions"
on public.question_bank for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- quiz_attempts: members see own, staff see all
drop policy if exists "Members can read own quiz attempts" on public.quiz_attempts;
create policy "Members can read own quiz attempts"
on public.quiz_attempts for select
to authenticated
using (
  member_id in (select id from public.members where matric_number = current_setting('request.jwt.claims', true)::json->>'matric_number')
  or public.is_staff()
);

drop policy if exists "Staff can read all quiz attempts" on public.quiz_attempts;
create policy "Staff can read all quiz attempts"
on public.quiz_attempts for select
to authenticated
using (public.is_staff());

-- quiz_answers: visible through parent attempt ownership
drop policy if exists "Staff can read quiz answers" on public.quiz_answers;
create policy "Staff can read quiz answers"
on public.quiz_answers for select
to authenticated
using (public.is_staff());

-- topic_performance: staff read all
drop policy if exists "Staff can read topic performance" on public.topic_performance;
create policy "Staff can read topic performance"
on public.topic_performance for select
to authenticated
using (public.is_staff());

-- study_events: staff read all
drop policy if exists "Staff can read study events" on public.study_events;
create policy "Staff can read study events"
on public.study_events for select
to authenticated
using (public.is_staff());

-- question_extraction_jobs: staff manage own
drop policy if exists "Staff can manage extraction jobs" on public.question_extraction_jobs;
create policy "Staff can manage extraction jobs"
on public.question_extraction_jobs for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- ── 6. Realtime publications ───────────────────────────────

do $$ begin
  alter publication supabase_realtime add table public.quiz_attempts;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.study_events;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.topic_performance;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Migration complete. Run supabase-seed.sql next.
-- ============================================================
