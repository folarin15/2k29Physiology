-- Study engine: AI question extraction, quizzes, exam room, streaks, and topic tracking.

create table if not exists public.question_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'skipped')),
  question_count integer not null default 0,
  error text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(resource_id)
);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references public.resources(id) on delete set null,
  course_code text not null,
  topic text not null default 'General',
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text not null default '',
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  source_hint text,
  confidence numeric(4, 2) not null default 0.70,
  status text not null default 'published' check (status in ('published', 'review', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  mode text not null check (mode in ('practice', 'exam')),
  course_code text not null,
  topic text,
  question_count integer not null default 0,
  score integer not null default 0,
  duration_seconds integer not null default 0,
  motivation_text text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now()
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  selected_answer text,
  correct boolean not null default false,
  answered_at timestamptz not null default now()
);

create table if not exists public.topic_performance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  course_code text not null,
  topic text not null,
  attempts integer not null default 0,
  correct integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(member_id, course_code, topic)
);

create table if not exists public.study_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_type text not null check (event_type in ('read', 'quiz', 'exam')),
  course_code text,
  resource_id uuid references public.resources(id) on delete set null,
  attempt_id uuid references public.quiz_attempts(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.question_extraction_jobs enable row level security;
alter table public.question_bank enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.topic_performance enable row level security;
alter table public.study_events enable row level security;

create index if not exists question_bank_course_topic_idx
on public.question_bank(course_code, topic, status);

create index if not exists question_bank_resource_idx
on public.question_bank(resource_id);

create index if not exists question_extraction_jobs_status_idx
on public.question_extraction_jobs(status, updated_at desc);

create index if not exists quiz_attempts_member_idx
on public.quiz_attempts(member_id, submitted_at desc);

create index if not exists quiz_answers_attempt_idx
on public.quiz_answers(attempt_id);

create index if not exists topic_performance_member_idx
on public.topic_performance(member_id, course_code, updated_at desc);

create index if not exists study_events_member_day_idx
on public.study_events(member_id, created_at desc);

drop policy if exists "Staff can read question extraction jobs" on public.question_extraction_jobs;
create policy "Staff can read question extraction jobs"
on public.question_extraction_jobs for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can read question bank" on public.question_bank;
create policy "Staff can read question bank"
on public.question_bank for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can manage question bank" on public.question_bank;
create policy "Staff can manage question bank"
on public.question_bank for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Staff can read quiz attempts" on public.quiz_attempts;
create policy "Staff can read quiz attempts"
on public.quiz_attempts for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can read quiz answers" on public.quiz_answers;
create policy "Staff can read quiz answers"
on public.quiz_answers for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can read topic performance" on public.topic_performance;
create policy "Staff can read topic performance"
on public.topic_performance for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can read study events" on public.study_events;
create policy "Staff can read study events"
on public.study_events for select
to authenticated
using (public.is_staff());

drop policy if exists "No direct student question access" on public.question_bank;
create policy "No direct student question access"
on public.question_bank for select
to anon
using (false);

grant select on public.question_extraction_jobs to authenticated;
grant select, insert, update, delete on public.question_bank to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.quiz_answers to authenticated;
grant select on public.topic_performance to authenticated;
grant select on public.study_events to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.question_extraction_jobs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.question_bank;
exception when duplicate_object then null;
end $$;
