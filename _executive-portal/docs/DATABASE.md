# PhysioK29 — Database Documentation

## Overview
- **Project Ref**: `rfrlddiebyfojnzbfldy`
- **Supabase URL**: `https://rfrlddiebyfojnzbfldy.supabase.co`
- **Region**: (default Supabase region)
- **Schema**: `public`

---

## Tables

### `public.members`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | Primary key |
| `name` | `text` | — | Normalized class-list name |
| `matric_number` | `text` | — | Unique identifier |
| `created_at` | `timestamptz` | `now()` | Registration timestamp |
| `last_seen_at` | `timestamptz` | `now()` | Last portal visit |
| `notification_enabled` | `boolean` | `false` | Push notification opt-in |
| `onesignal_subscription_id` | `text` | — | OneSignal subscriber ID |
| `notification_last_seen_at` | `timestamptz` | — | Last notification check |
| `notification_updated_at` | `timestamptz` | — | Last notification update |
| `full_name` | `text` | — | Preferred full name (birthday) |
| `date_of_birth` | `date` | — | Date of birth (for birthday celebrations) |
| `birthday_photo_url` | `text` | — | Public URL to birthday photo |
| `birthday_registration_completed` | `boolean` | `false` | Birthday profile completed |
| `birthday_photo_updated_at` | `timestamptz` | — | Last photo update |

**Indexes**:
- `idx_members_date_of_birth` on `date_of_birth` WHERE `birthday_registration_completed = true`
- `resource_progress_member_idx` on `member_id, updated_at desc`
- `member_access_attempts_lookup_idx` on `action, client_key, success, created_at desc`

**Relationships**:
- `id` referenced by `resource_progress.member_id`, `resource_feedback.member_id`, `quiz_attempts.member_id`, `topic_performance.member_id`, `study_events.member_id`, `quiz_answers.attempt_id` (indirect via quiz_attempts)

**RLS**: Enabled — Staff can SELECT, Admin can DELETE, No public INSERT/UPDATE (all mutations via Edge Functions)

---

### `public.allowed_members`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `matric_number` | `text` | — | Primary key — pre-approved matric numbers |
| `name` | `text` | — | Official class-list name |
| `created_at` | `timestamptz` | `now()` | When added |

**RLS**: Enabled — Staff can SELECT, Admin can manage all

---

### `public.staff_roles`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | `uuid` | — | PK, references `auth.users(id)` ON DELETE CASCADE |
| `role` | `text` | — | CHECK `('rep', 'admin')` |
| `display_name` | `text` | — | Human-readable name |
| `created_at` | `timestamptz` | `now()` | When assigned |

**RLS**: Enabled — Users can read their own role, Admin can manage all

---

### `public.resources`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | Primary key |
| `title` | `text` | — | Resource title |
| `course_code` | `text` | — | e.g. PHY 102 |
| `course_title` | `text` | — | Full course title |
| `type` | `text` | `'Resource'` | Resource type |
| `note` | `text` | — | Description / note |
| `file_name` | `text` | — | Original filename |
| `file_size` | `bigint` | — | File size in bytes |
| `file_type` | `text` | — | MIME type |
| `storage_path` | `text` | — | Path in `class-resources` bucket |
| `download_url` | `text` | — | Signed URL (regenerated on read) |
| `uploaded_by` | `text` | — | Display name of uploader |
| `uploaded_by_user_id` | `uuid` | — | References `auth.users(id)` |
| `created_at` | `timestamptz` | `now()` | Upload timestamp |
| `week` | `integer` | — | Week number (for lectures) |
| `lecture_date` | `date` | — | Date of lecture |
| `lecture_topic` | `text` | — | Lecture topic |
| `lecture_venue` | `text` | — | Lecture venue |
| `upload_category` | `text` | `'resource'` | `'resource'` or `'lecture'` |

**Indexes**: `resources_uploaded_by_user_id_idx`, `idx_resources_category`, `idx_resources_week`

**RLS**: Enabled — Staff can SELECT, INSERT, UPDATE own, Admin can manage all

---

### `public.resource_progress`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `member_id` | `uuid` | — | FK → `members(id)` ON DELETE CASCADE |
| `resource_id` | `uuid` | — | FK → `resources(id)` ON DELETE CASCADE |
| `status` | `text` | `'opened'` | CHECK `('opened','reading','urgent','done')` |
| `opened_count` | `integer` | `0` | Times opened |
| `current_page` | `integer` | — | Last page viewed |
| `total_pages` | `integer` | — | Total pages in file |
| `progress_percent` | `numeric(5,2)` | `0` | Percentage complete |
| `first_opened_at` | `timestamptz` | `now()` | First access |
| `last_opened_at` | `timestamptz` | `now()` | Last access |
| `updated_at` | `timestamptz` | `now()` | Last update |

**Unique**: `(member_id, resource_id)`

**RLS**: Enabled — Staff can SELECT

---

### `public.resource_feedback`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `member_id` | `uuid` | — | FK → `members(id)` |
| `resource_id` | `uuid` | — | FK → `resources(id)` |
| `helpful` | `boolean` | `true` | Was this helpful? |
| `created_at` | `timestamptz` | `now()` | Created |
| `updated_at` | `timestamptz` | `now()` | Updated |

**Unique**: `(member_id, resource_id)`

**RLS**: Enabled — Staff can SELECT

---

### `public.announcements`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `title` | `text` | — | Title |
| `message` | `text` | — | Body |
| `priority` | `text` | `'Normal'` | CHECK `('Normal','Important','Urgent')` |
| `posted_by` | `text` | — | Display name |
| `posted_by_user_id` | `uuid` | — | FK → `auth.users(id)` |
| `created_at` | `timestamptz` | `now()` | Posted |

**RLS**: Enabled — Staff can SELECT/INSERT, Admin can manage all

---

### `public.suggestions`
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `name` | `text` | — | Student name |
| `matric_number` | `text` | — | Student matric |
| `category` | `text` | `'General'` | Category |
| `message` | `text` | — | Suggestion text |
| `created_at` | `timestamptz` | `now()` | Submitted |

**RLS**: Enabled — Staff can SELECT, Admin can DELETE

---

### `public.member_access_attempts`
Audit log for registration attempts. Columns: `id`, `action`, `client_key`, `matric_number`, `submitted_name`, `failure_reason`, `success`, `created_at`.

**RLS**: Enabled — No direct access (inserted only by Edge Function with service_role)

---

### `public.question_bank`
MCQ pool for quizzes. Columns: `id`, `course_code`, `topic`, `question_text`, `options` (JSONB), `correct_answer`, `explanation`, `difficulty`, `source_hint`, `status`, `created_at`.

**RLS**: Enabled — Students read published, Staff manage all

---

### `public.quiz_attempts`
| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `member_id` | `uuid` | FK → `members(id)` |
| `mode` | `text` | `'practice'` or `'exam'` |
| `course_code` | `text` | Course |
| `topic` | `text` | Topic |
| `question_count` | `integer` | Total questions |
| `score` | `integer` | Correct answers |
| `duration_seconds` | `integer` | Time taken |
| `motivation_text` | `text` | Auto-generated motivational message |
| `started_at` | `timestamptz` | Quiz start |
| `submitted_at` | `timestamptz` | Quiz submit |

**RLS**: Enabled — Members read own, Staff read all

---

### `public.quiz_answers`
Per-question answers within an attempt. Columns: `id`, `attempt_id` (FK → `quiz_attempts`), `question_id` (FK → `question_bank`), `selected_answer`, `correct`.

**RLS**: Enabled — Staff only

---

### `public.topic_performance`
| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `member_id` | `uuid` | FK → `members(id)` |
| `course_code` | `text` | Course |
| `topic` | `text` | Topic |
| `attempts` | `integer` | Total attempts |
| `correct` | `integer` | Correct count |
| `updated_at` | `timestamptz` | Last updated |

**Unique**: `(member_id, course_code, topic)`
**RLS**: Enabled — Staff only

---

### `public.study_events`
| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `member_id` | `uuid` | FK → `members(id)` |
| `event_type` | `text` | CHECK `('read','quiz','exam')` |
| `course_code` | `text` | Course |
| `resource_id` | `uuid` | FK → `resources(id)` |
| `attempt_id` | `uuid` | FK → `quiz_attempts(id)` |
| `created_at` | `timestamptz` | Timestamp |

**RLS**: Enabled — Staff only

---

### `public.question_extraction_jobs`
Tracks PDF→MCQ extraction runs. Columns: `id`, `member_id`, `storage_path`, `status`, `course_code`, `questions_extracted`, `error_message`, `created_at`.

**RLS**: Enabled — Staff manage own

---

### `public.birthday_notifications`
| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `created_at` | `timestamptz` | When logged |
| `notification_type` | `text` | `'today'`, `'tomorrow'`, `'this_week'` |
| `member_count` | `integer` | Number of members |
| `members_json` | `jsonb` | Array of member objects |
| `webhook_sent` | `boolean` | Whether webhook was called |
| `webhook_response` | `text` | Response from webhook |
| `triggered_by` | `text` | `'cron'` or `'manual'` |
| `error` | `text` | Error message if any |

**RLS**: Enabled — Staff only

---

## Relationships Summary

```
auth.users
  └─ staff_roles.user_id (1:1, optional)
  └─ resources.uploaded_by_user_id
  └─ announcements.posted_by_user_id

members
  ├─ resource_progress.member_id (1:N)
  ├─ resource_feedback.member_id (1:N)
  ├─ quiz_attempts.member_id (1:N)
  ├─ topic_performance.member_id (1:N)
  ├─ study_events.member_id (1:N)
  └─ birthday_notifications.members_json (embedded, logical)

resources
  ├─ resource_progress.resource_id (1:N)
  └─ resource_feedback.resource_id (1:N)

question_bank
  └─ quiz_answers.question_id (1:N)

quiz_attempts
  ├─ quiz_answers.attempt_id (1:N)
  └─ study_events.attempt_id (1:N, optional)
```

## Key Differences Between Member and Auth User
- **Members** (`members` table): Created via custom registration flow (name + matric). Have a local `uuid` ID. No Supabase Auth user.
- **Auth Users** (`auth.users`): Created only for staff (admin/rep) via Supabase Auth email/password. Linked via `staff_roles.user_id`.
- A person can be BOTH a member AND an auth user (if they're a rep who also registered).
