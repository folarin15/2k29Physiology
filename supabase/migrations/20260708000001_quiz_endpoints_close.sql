-- Close all quiz/study endpoints: ensure RLS policies allow member-portal function access
-- This makes question_bank, quiz_attempts, quiz_answers, topic_performance, study_events
-- accessible through the member-portal Edge Function (service_role) while blocking direct public access.

-- --- question_bank ---
drop policy if exists "member-portal can manage question_bank" on public.question_bank;
create policy "member-portal can manage question_bank"
on public.question_bank
to service_role
using (true)
with check (true);

grant select on public.question_bank to service_role;
grant insert, update, delete on public.question_bank to service_role;

-- --- quiz_attempts ---
drop policy if exists "member-portal can manage quiz_attempts" on public.quiz_attempts;
create policy "member-portal can manage quiz_attempts"
on public.quiz_attempts
to service_role
using (true)
with check (true);

grant select, insert, update on public.quiz_attempts to service_role;

-- --- quiz_answers ---
drop policy if exists "member-portal can manage quiz_answers" on public.quiz_answers;
create policy "member-portal can manage quiz_answers"
on public.quiz_answers
to service_role
using (true)
with check (true);

grant select, insert on public.quiz_answers to service_role;

-- --- topic_performance ---
drop policy if exists "member-portal can manage topic_performance" on public.topic_performance;
create policy "member-portal can manage topic_performance"
on public.topic_performance
to service_role
using (true)
with check (true);

grant select, insert, update on public.topic_performance to service_role;

-- --- study_events ---
drop policy if exists "member-portal can manage study_events" on public.study_events;
create policy "member-portal can manage study_events"
on public.study_events
to service_role
using (true)
with check (true);

grant select, insert on public.study_events to service_role;

-- --- members ---
grant update (notification_enabled, onesignal_subscription_id, notification_last_seen_at, notification_updated_at) on public.members to service_role;

-- --- resource_progress ---
grant select, insert, update on public.resource_progress to service_role;

-- --- resource_feedback ---
grant select, insert, update on public.resource_feedback to service_role;

-- --- suggestions ---
grant insert on public.suggestions to service_role;

-- --- storage buckets for signed URLs ---
grant select on storage.objects to service_role;

-- Realtime publications for the new tables
do $$
begin
  alter publication supabase_realtime add table public.quiz_attempts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.topic_performance;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.study_events;
exception when duplicate_object then null;
end $$;
