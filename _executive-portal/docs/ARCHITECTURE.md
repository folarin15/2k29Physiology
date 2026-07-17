# PhysioK29 — Full Architecture & Data Map

## Two Sites, One Supabase

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT PORTAL (class site)                  │
│  app.v20260717-1.js — loaded on K29.admin/ and K29.rep/ pages  │
│                                                                 │
│  Students log in with: NAME + MATRIC NUMBER                     │
│  → Checks allowed_members table for name match                  │
│  → Creates/updates row in members table                         │
│  → Uses member-portal Edge Function (service_role)              │
│                                                                 │
│  Features: Quiz, Exam, Reader, Timetable,                       │
│            Birthday onboarding, Suggestions                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │ same Supabase project
┌──────────────────────▼──────────────────────────────────────────┐
│                   EXECUTIVE PORTAL (staff site)                  │
│  executive.v20260717-1.js — standalone with exec-bootstrap.js   │
│                                                                 │
│  Staff log in with: EMAIL + PASSWORD                            │
│  → Supabase Auth (auth.users table)                             │
│  → Queries staff_roles for role (admin, rep, treasurer, etc.)   │
│  → Sets state.staffRole + state.authUser                        │
│                                                                 │
│  Features: Member list, Analytics, Resources CRUD,              │
│            Announcements, Suggestions, Receipts,                 │
│            Birthdays, Study monitor                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    SUPABASE BACKEND                             │
│  URL: https://rfrlddiebyfojnzbfldy.supabase.co                 │
│  anon key: (in supabase-config.js)                              │
│  service_role key: (for Edge Functions only)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Supabase Tables — Complete Data Map

### 🧑‍🎓 students / members

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`allowed_members`** | Class list (matric + name) | Admin INSERT via SQL | Student login validation |
| **`members`** | Student profiles | Student registration (Edge Function) | Both portals |
| **`member_access_attempts`** | Login audit log | Edge Function | Security |

**members columns:**
`id`, `name`, `matric_number`, `full_name`, `date_of_birth`, `birthday_photo_url`,
`birthday_registration_completed`, `email`, `class`, `enrollment_status`, `photo_url`,
`notification_enabled`, `onesignal_subscription_id`, `last_seen_at`, `created_at`

### 👤 staff auth

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`auth.users`** (Supabase Auth) | Email + password login | Admin invite or API | Staff login |
| **`staff_roles`** | Maps auth user → role | Admin INSERT via SQL | Portal role check |

**staff_roles columns:** `id` (PK), `user_id` (unique FK → auth.users),
`role` (admin|representative|academic|treasurer|auditor|designer),
`display_name`, `created_at`

### 📚 courses & resources

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`courses`** | Course codes + names | Admin INSERT via SQL | Resource upload dropdown |
| **`resources`** | Uploaded files | Staff upload via portal | Resource list, downloads |
| **`resource_progress`** | Per-student read status | Student reader activity | Engagement analytics |
| **`resource_feedback`** | Helpfulness votes | Student reader activity | Resource quality metrics |

**resources columns:** `id`, `course_code`, `title`, `file_name`, `file_type`,
`file_size`, `storage_path`, `download_url`, `uploaded_by`, `uploaded_by_user_id`,
`week`, `lecture_date`, `lecture_topic`, `lecture_venue`, `upload_category`, `created_at`

### 📊 quiz & analytics

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`question_bank`** | MCQ question pool | Seed script or AI extraction | Quiz engine |
| **`quiz_attempts`** | Quiz submissions | Student quiz activity | Analytics, leaderboard |
| **`quiz_answers`** | Per-question results | Student quiz activity | Detailed analytics |
| **`topic_performance`** | Per-topic accuracy | Aggregated from quizzes | Member history panel |
| **`study_events`** | Daily activity log | Quiz + reader activity | Weekly chart |

**quiz_attempts columns:** `id`, `member_id`, `mode` (practice|exam),
`course_code`, `topic`, `question_count`, `score`, `percent`,
`duration_seconds`, `motivation_text`, `submitted_at`

### 📢 communication

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`announcements`** | Staff posts | Staff via portal | Announcement list |
| **`suggestions`** | Student submissions | Student via portal | Suggestions list |

### 💰 finance

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`receipts`** | Payment records | Treasurer via portal | Treasurer/Auditor flow |

**receipts columns:** `id`, `receipt_number`, `purpose`, `amount`, `date`,
`uploaded_by`, `uploader_role`, `students` (jsonb), `student_details` (jsonb),
`status` (pending|verified), `verified_by`, `verified_at`, `receipt_url`, `created_at`

### 🎂 birthdays

| Table | Purpose | Populated By | Used By |
|---|---|---|---|
| **`members.date_of_birth`** | Student birthday | Birthday onboarding | Birthday dashboard |
| **`birthday_notifications`** | Notification log | Cron function | Audit log |

### 📦 storage buckets

| Bucket | Visibility | Policies | Used For |
|---|---|---|---|
| **`class-resources`** | Private (RLS) | Staff can SELECT/INSERT; Admin can DELETE | PDFs, PPTs, docs |
| **`birthday-photos`** | Public | Anyone SELECT; Members INSERT/UPDATE | Profile photos |

---

## Current Data State (as of last seed)

| Table | Rows | Status |
|---|---|---|
| `members` | 70 | Students have registered |
| `resources` | 446 | Files uploaded |
| `quiz_attempts` | 203 | Analytics data |
| `study_events` | 14 | Activity log |
| `resource_progress` | 71 | Reading engagement |
| `topic_performance` | 784 | Per-topic accuracy |
| `courses` | 33 | Real course codes |
| `staff_roles` | 5 | 1 admin + 2 reps + 1 treasurer + 1 designer |
| `announcements` | 3 | Sample posts |
| `suggestions` | 3 | Sample submissions |
| `receipts` | 1 | Sample receipt |

---

## Auth Users Created

| Email | Role | Password |
|---|---|---|
| `akinteyeakinbode6@gmail.com` | admin | (existing) |
| `khimnana2324@gmail.com` | representative | (existing) |
| `he.is.rapflames2334@gmail.com` | representative | (existing) |
| `memshimaaondonaaa@gmail.com` | treasurer | `physiology` |
| `iyandabanji09@gmail.com` | designer | `physiology` |
| `enochomoniyi05@gmail.com` | designer | `physiology` |

---

## File Structure — Key Files

```
/
├── app.v20260717-1.js          ← Student portal (clean, no exec code)
├── app.js                      ← Mirror of above
├── app.v20260716-1.js          ← Older versioned copy
├── executive.v20260717-1.js    ← Extracted exec functions (legacy)
├── exec-bootstrap.js           ← NEW: Standalone exec portal bootstrap
├── supabase-exec-portal-migration.sql  ← Migration for new tables
├── seed-allowed-members.sql    ← 83-student class list seed
├── supabase-service.js         ← Backend service (shared)
├── supabase-config.js          ← Supabase config (shared)
├── supabase-schema.sql         ← Core schema + RLS + functions
├── supabase-migration.sql      ← Quiz/study tables
├── supabase-birthday-migration.sql  ← Birthday columns + bucket
│
├── K29.admin/index.html        ← Admin page (loads exec portal)
├── K29.rep/index.html          ← Rep page (loads exec portal)
│
├── _executive-portal/
│   ├── exec-bootstrap.js       ← Auth, role resolution, data fetching
│   ├── utils/supabase-client.js  ← Supabase client
│   ├── utils/session.js        ← Session helpers
│   ├── utils/helpers.js        ← Display helpers
│   ├── constants/SHARED_CONSTANTS.js
│   ├── constants/COURSE_DATA.js
│   └── docs/MIGRATION_NOTES.md ← Original migration notes
│
├── supabase/functions/
│   ├── member-portal/index.ts  ← Main Edge Function (student actions)
│   ├── birthday-notify/index.ts  ← Cron birthday check
│   ├── send-portal-notification/index.ts  ← Push notifications
│   ├── question-extractor/index.ts  ← AI MCQ extraction
│   └── generate-resource-details/index.ts  ← AI metadata gen
│
└── scripts/
    ├── seed-exec-portal.mjs    ← Seed script for courses + sample data
    ├── seed-questions.mjs      ← Seed script for question_bank
    ├── migrate-staff-roles.mjs ← Staff_roles migration helper
    └── build-static.mjs        ← Static build
```

---

## Auth Flow (Executive Portal)

```
1. User visits K29.admin/index.html or standalone exec portal
2. exec-bootstrap.js creates ExecutiveBackend class
3. signInRep(email, password) called on form submit
     → this._supabase.auth.signInWithPassword({ email, password })
     → Supabase checks auth.users table
4. On success, _resolveRole(user) called
     → SELECT role, display_name FROM staff_roles WHERE user_id = '...'
     → Sets state.staffRole, state.staffName, state.authUser
5. Portal renders based on role:
     admin → full access
     treasurer → receipts + member list
     designer → birthday management + member list
     auditor → receipts verify
     representative (rep) → resources + announcements
     academic → study analytics
```

---

## Student Sign-In Flow

```
1. Student enters name + matric number on login page
2. app.v20260717-1.js calls _backend.callMemberPortal("register", ...)
3. Edge Function (member-portal) calls register_member(name, matric) RPC
4. RPC function:
     a. Normalizes name + matric
     b. Checks allowed_members for matric match
     c. Checks member_name_matches() for name match
     d. INSERT INTO members (name, matric_number) ON CONFLICT UPDATE
     e. Returns member UUID
5. Student session stored in localStorage
```

---

## RLS Policy Pattern

All staff-facing tables use this pattern:

```sql
CREATE POLICY "Staff can read <table>"
ON public.<table> FOR SELECT
TO authenticated
USING (public.is_staff());
```

`is_staff()` returns true if auth user's role in `staff_roles` is one of:
`admin`, `representative`, `academic`, `treasurer`, `auditor`, `designer`

Admin-only operations also check `public.is_admin()`.

Student-facing operations go through the `member-portal` Edge Function
(with `security definer` + `service_role`), bypassing RLS.

---

## What's Running on the Site

The deployed site (via Pxxl) serves:
- **Student login** → `K29.admin/index.html` loads `app.v20260717-1.js`
- **Executive portal** → same page loads `executive.v20260717-1.js` as second module
- **Standalone exec portal** → `_executive-portal/` directory (for future separation)

---

## If Something Breaks

1. Check `staff_roles` has the user's UUID and correct role
2. Check RLS policies exist for the table that's failing
3. Check `public.is_staff()` returns true (run: `SELECT is_staff()` in SQL Editor while logged in)
4. Check the table has data (run: `SELECT count(*) FROM <table>`)
5. For student login: check `allowed_members` has the matric number
6. For resources: check `class-resources` storage bucket has the file
