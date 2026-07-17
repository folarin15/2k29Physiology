# PhysioK29 — Authentication Documentation

## Two Authentication Systems

PhysioK29 uses two separate authentication mechanisms depending on user type.

---

### 1. Student Authentication (Custom Portal Auth)

**Flow**:
1. Student visits any student-facing page (e.g., `dashboard.html`)
2. `ensureMemberOnboarding()` checks `localStorage` for existing session (`physiology2k29.memberSession`)
3. If no session → full-screen registration overlay is shown
4. Student enters name + matric number
5. Form calls `state.backend.registerMember(profile)` → invokes Edge Function `member-portal` with `action: "register"`
6. Edge Function calls `register_member()` SQL function (security definer, service_role only):
   - Validates matric exists in `allowed_members` table
   - Validates name matches via fuzzy matching (`member_name_matches()`)
   - Creates/updates `members` row
   - Returns `memberId` (UUID)
7. Frontend stores `{ memberId, name, matricNumber, savedAt }` in `localStorage` and a cookie backup

**Session Validation**:
- On subsequent visits, `ensureMemberOnboarding()` calls `state.backend.refreshMemberSession(session)` → Edge Function `refresh` action
- Edge Function calls `refresh_member_seen()` SQL function
- Returns `{ ok: true }` if session is valid, or throws 403 if invalid

**Key characteristics**:
- No Supabase Auth user created for students
- Session is a client-side JSON blob
- No email/password required
- All DB operations go through the Edge Function (service_role key)
- RLS policies DO NOT apply to student operations (they bypass RLS via service_role)

---

### 2. Staff Authentication (Supabase Auth)

**Flow**:
1. Staff (admin/rep) visits `K29.admin/index.html` or `K29.rep/index.html`
2. `connectStaffPortal()` calls `supabase.auth.onAuthStateChange()` to listen for auth events
3. If no session → login form is shown (`#staffLoginPanel`)
4. Staff enters email + password
5. `signInRep(email, password)` → calls `supabase.auth.signInWithPassword()`
6. On success, `onAuth()` callback fires → calls `getRole(uid)` → reads `staff_roles` table
7. If role is valid (`admin` or `rep`), staff portal content is revealed

**Staff Roles**:
- `admin` — Full access: upload, manage, delete, analytics, bulk upload, member management
- `rep` — Limited access: upload own, post announcements, view suggestions/members (no delete)

**Session Persistence**:
- Supabase Auth manages its own session (JWT in localStorage `sb-{ref}-auth-token`)
- Staff session persists across browser sessions (unless signed out)

**Auth State Changes**:
- `onAuth()` callback detects login/logout events
- On logout → staff portal hides, login form shows
- On login → role checked, portal content revealed

---

### 3. Key Differences

| Aspect | Student | Staff |
|--------|---------|-------|
| Auth method | Custom portal (name + matric) | Supabase Auth (email + password) |
| Storage key | `physiology2k29.memberSession` | `sb-{ref}-auth-token` |
| Backend auth | Via Edge Function (service_role) | Direct Supabase queries (anon key + RLS) |
| User record | `members` table | `auth.users` + `staff_roles` table |
| Session expiry | No expiry (cleared manually) | Managed by Supabase |
| RLS | Bypassed (service_role) | Enforced (anon key) |

---

### 4. API Key Usage

**Anon Key** (public, in client JS):
```js
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmxkZGllYnlmb2puemJmbGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDQ3MDgsImV4cCI6MjA5NDg4MDcwOH0.3nHfDHpkVPUNyxz65_IOPqx8H0F1QA6kxzi1AHFI7oU
```
Used for:
- Staff portal (Supabase Auth + RLS-protected queries)
- Student birthday photo uploads (public bucket)

**Service Role Key** (secret, server-side only):
Used in Edge Functions for:
- Member registration
- All student data operations
- Push notifications
- Birthday notifications
- All operations that bypass RLS

---

### 5. Security Considerations

- Service role key must NEVER be exposed in client-side code
- Rate limiting: 12 failed registration attempts per 10 minutes per IP
- Name matching uses fuzzy logic to handle spelling variations
- Student sessions have no expiry (but can be reset via `?resetStudent` query param)
- Staff accounts are created manually in the Supabase dashboard
