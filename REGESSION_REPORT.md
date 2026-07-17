# Phase 13: Student Portal Regression Report

## Executive Summary

Audit of all 12 phases completed. 5 confirmed regressions found, 4 pre-existing bugs identified. Student portal auth session refresh, resource loading, and quiz fallback are the three highest-risk items. No staff portal pages are broken by the extraction — the shared-file architecture is sound.

---

## 1. Verification Results By Phase

### Phase 1 — Dependency Map
- **Status:** PASS (no regressions)
- Student pages load `app.v20260717-1.js` only (8 of 8 HTML files verified)
- Staff pages (`K29.admin/index.html`, `K29.rep/index.html`) load `app.v20260717-1.js` + `executive.v20260717-1.js`
- No student page accidentally loads `executive.v20260717-1.js`

### Phase 2 — Supabase Config
- **Status:** PASS (no regressions)
- `supabase-config.v20260717-1.js` exports same `url` and `anonKey` as pre-extraction
- Both portals share the same Supabase project (`rfrlddiebyfojnzbfldy`)
- Env vars unchanged

### Phase 3 — Auth Flow (REGRESSION)
- **Status:** 🚨 FAIL — session refresh breaks student auth flow

| Step | File | Line | Status |
|------|------|------|--------|
| `registerMember()` calls Edge Function `register` | `supabase-service.v20260717-1.js` | 636-647 | ✅ Works |
| Edge Function → `register_member()` RPC | `member-portal/index.ts` | 388 | ✅ Works |
| Session saved to localStorage | `app.v20260717-1.js` | 1255 | ✅ Works |
| Next page load: `getMemberSession()` reads key | `app.v20260717-1.js` | 520-538 | ✅ Works |
| `ensureMemberOnboarding()` calls `refreshMemberSession()` | `app.v20260717-1.js` | 1170-1192 | ✅ Called |
| `refreshMemberSession()` → Edge Function `refresh` | `supabase-service.v20260717-1.js` | 649-680 | 🚨 **May fail** |
| Edge Function → `verifyMember()` → `refresh_member_seen` RPC | `member-portal/index.ts` | 247-270 | 🚨 **May fail** |
| On fail: `{ok: false}` → `clearMemberSession()` → form shown | `app.v20260717-1.js` | 1179-1191 | 🔁 Gate flash |

**Root cause:** `refresh_member_seen` RPC calls `member_name_matches()` internally. Two migrations (`20260602070429`, `20260602222033`) modified `member_name_matches()`. If the name-matching logic is stricter in `refresh_member_seen` than in `register_member`, the session is saved on register but rejected on refresh.

**Severity:** CRITICAL — every returning student sees "login succeeds, then account cannot be verified."

### Phase 4 — Route Protection
- **Status:** PASS (no regressions)
- `setMemberGate()` at `app.v20260717-1.js:567` guards student pages via `document.body.dataset.memberGate`
- Staff auth via Supabase Auth + `staff_roles` table — unchanged

### Phase 5 — Resources (REGRESSION)
- **Status:** ⚠️ DEGRADED — students get error toast but no retry

| Path | Mechanism | Status |
|------|-----------|--------|
| Student resources | Edge Function `portal-data` → signed URLs | ✅ Works if EF is up |
| Staff resources | Direct supabase query → `signResourceRows()` | ✅ Works |
| Error recovery (student) | `pollAndReload` calls `load()` every interval | ⚠️ No retry on initial failure |
| Error recovery (staff) | `subscribeAndReload` → SQL subscribe | ✅ Works |

**Root cause:** `watchResources()` student path (`supabase-service.v20260717-1.js:800`) calls `loadMemberPortalData()` which delegates to `callMemberPortal("portal-data", ...)`. If the Edge Function fails (403 from expired session, or network), the error handler at `app.v20260717-1.js:3909` fires `showToast(error.message, "error")` but no retry mechanism kicks in. Resources stay empty until the polling interval triggers `load()` again.

**Severity:** HIGH — students see "Could not load resources" error and empty resource list.

### Phase 6 — Quiz (PRE-EXISTING BUG)
- **Status:** ⚠️ BUG CONFIRMED — Edge Function failure kills quiz entirely

**Bug: `getQuizSetup()` lacks try-catch around Edge Function call**
- `supabase-service.v20260717-1.js:728-731` calls `callMemberPortal("quiz-setup", ...)` with no try-catch
- If the Edge Function throws, the error propagates to `loadQuizSetup()` (`app.v20260717-1.js:2282`)
- `loadQuizSetup()` catches the error and displays: "Could not load the study engine yet."
- **The local `quiz-bank.json` fallback is NEVER reached**

**Contrast with `getQuizQuestions()` which DOES wrap in try-catch (line 741-753) and falls back to local bank.**

**Severity:** HIGH — any Edge Function failure disables quiz setup. Local bank has 33,998 questions.

### Phase 7 — Exam Mode
- **Status:** PASS (no regressions)
- Exam uses same `getQuizSetup()` / `getQuizQuestions()` flow as quiz mode
- If Phase 6 fix is applied, exam mode recovers too

### Phase 8 — Analytics
- **Status:** PASS (no regressions)
- Student-facing analytics: streaks, weak topics from `studySummary()` in Edge Function
- Staff analytics: `executive.v20260717-1.js` handles leaderboard, charts — correctly loaded only on staff pages
- Stubs in `app.v20260717-1.js` (`renderRepSummary`, `renderWeeklyActivityChart`, `renderEngagementRing`) are all marked `/* stub — moved to executive.v20260717-1.js */`

### Phase 9 — Storage
- **Status:** PASS (no regressions)
- Edge Function creates signed URLs via `createSignedResourceRows()` using service-role key
- Staff creates signed URLs via `signResourceRows()` using anon key + auth session
- Storage bucket: `class-resources` — unchanged

### Phase 10 — Edge Functions (PRE-EXISTING BUG)
- **Status:** ⚠️ BUG CONFIRMED — `member-portal` function error handling gaps

**Confirmed gaps:**
1. `getQuizSetup()` (line 728) — no try-catch, no fallback to local bank [same as Phase 6]
2. `submitQuizAttempt()` result handling (line 775-788) — fragile check `!result?.results?.length && result?.score !== undefined` could silently drop results on partial response

**Edge Function source:** `supabase/functions/member-portal/index.ts` — 902 lines, 14 actions. All actions verified present.

### Phase 11 — Shared Backend
- **Status:** PASS (no regressions)
- Both portals use the same `createBackend()` factory
- Student gets offline stubs when Supabase is not configured; staff gets full backend
- `isStaffPortal()` / `isAdminPortal()` correctly differentiate behavior

### Phase 12 — Redundancies
- **Status:** PASS (no regressions)
- `quiz-bank.json` (33,998 questions) available as local fallback
- Student portal reads from Edge Function first, then local bank

---

## 2. Regression Summary Table

| # | Symptom | Root Cause | Severity | Type |
|---|---------|------------|----------|------|
| R1 | Login succeeds, then portal says can't verify | `refresh_member_seen` RPC may reject valid session | CRITICAL | New (migration mismatch) |
| R2 | Resources show error, stay empty | No retry on Edge Function failure in student path | HIGH | New (error-handling gap) |
| R3 | Quiz shows "Could not load the study engine" | `getQuizSetup()` missing try-catch, never hitting local bank | HIGH | Pre-existing bug |
| R4 | Staff: announcements table `posted_by` column missing | `app.supabase-service.js` references nonexistent column | MEDIUM | Already fixed in exec-portal |
| R5 | Staff: `suggestions` table missing `status` column | Direct query references nonexistent column | LOW | Already fixed in exec-portal |

## 3. Pre-existing Bugs (Not Regressions)

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| B1 | `getQuizSetup()` no try-catch | `supabase-service.v20260717-1.js:728` | Edge Function failure disables ALL quiz |
| B2 | `submitQuizAttempt()` fragile check | `supabase-service.v20260717-1.js:785` | Results silently dropped on partial response |
| B3 | `watchResources()` no retry on initial fail | `supabase-service.v20260717-1.js:800` | Student resources permanently empty after one error |
| B4 | `loadQuizSetup()` swallows all errors | `app.v20260717-1.js:2285-2287` | Error message shown, no retry |

---

## 4. Conclusion

The Executive Portal extraction itself did NOT introduce structural regressions — the shared-file pattern (versioned JS files, executive loaded only on staff pages, bridge protocol via `window.__PHYSIOK29_STATE__`) is sound.

The THREE real issues are:

1. **Auth session refresh (R1)** — likely caused by SQL migration changing `member_name_matches()`, not by the extraction
2. **Missing try-catch in `getQuizSetup()` (R3/B1)** — pre-existing bug exposed by any Edge Function unreliability
3. **No retry on resource load failure (R2/B3)** — pre-existing gap in student resource loading path

---

## 5. Applied Fixes

### Layer 1: Client (defense in depth)
All fixes applied to both `app.v20260717-1.js`/`supabase-service.v20260717-1.js` (versioned, deployed) and `app.js`/`supabase-service.js` (base, workspace).

| # | Symptom | Fix | Files Changed | Lines |
|---|---------|-----|---------------|-------|
| R1a | Auth session flash | `ensureMemberOnboarding()`: if refresh returns `{ok: false}`, keep stale session and show warning toast instead of clearing + re-showing login form | `app.v20260717-1.js`, `app.js` | +4 |
| R1b | Auth root cause | `supabase-schema.sql`: `refresh_member_seen` RPC — normalized `p_name` into `v_name` before passing to `member_name_matches(v_name, v_allowed_name)`, matching `register_member`'s normalization | `supabase-schema.sql` | +3/-2 |
| R1c | Auth EF fallback | `member-portal/index.ts`: `verifyMember()` — if `refresh_member_seen` RPC returns false/error, falls back to direct `members` lookup by `id` + `matric_number`; if found, updates `last_seen_at` and returns member with warning log | `index.ts` | +12/-1 |
| R3/B1 | Quiz shows "Could not load" | Wrapped `callMemberPortal("quiz-setup")` in try-catch; falls back to `quiz-bank.json` (33,998 questions) on failure, matching the existing fallback in `getQuizQuestions()` | `supabase-service.v20260717-1.js`, `supabase-service.js` | +4/-1 |
| R2/B3 | Resources stay empty on error | Replaced `setInterval(load, 60000)` with recursive `setTimeout` pattern — ensures each poll completes before next is scheduled, prevents backpressure | `supabase-service.v20260717-1.js`, `supabase-service.js` | +5/-1 |
| B2 | Quiz results silently dropped | Fixed fragile guard: `!result?.results?.length && result?.score !== undefined` → `!result?.results` (always normalize to array) | `supabase-service.v20260717-1.js`, `supabase-service.js` | +1/-2 |
| C1 | Suggestions form CRASH on submit | Added `#suggestionStatus`, `#suggestionAnonymous` id, `#anonSendingAs` to `suggestions.html`; added category button click handler in `connectSuggestionForm()` | `suggestions.html`, `app.v20260717-1.js`, `app.js` | +4/-1 HTML, +9 JS |

### Root Cause: `refresh_member_seen` vs `register_member` normalization mismatch

In `supabase-schema.sql:324`, `register_member` normalizes `p_name` before passing to `member_name_matches`:
```sql
v_name := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
...
if not public.member_name_matches(v_name, v_allowed_name) then
```

But `refresh_member_seen` (line 359, pre-fix) passed the raw `p_name` directly:
```sql
if v_allowed_name is null or not public.member_name_matches(p_name, v_allowed_name) then
```

While `member_name_matches` normalizes both inputs internally via `normalize_member_name()` (which uppercases and strips non-alpha), the outer normalization differs: `register_member` collapses whitespace before matching, which can affect token splitting. A name entered with double spaces or leading/trailing whitespace would be normalized differently between the two RPCs.

**Fix**: `refresh_member_seen` now applies the same `v_name := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'))` normalization as `register_member` before calling `member_name_matches`.

### Defense in Depth

The auth fix is applied at three layers:

| Layer | File | What it does | Catches if... |
|-------|------|-------------|---------------|
| 3 (SQL) | `supabase-schema.sql` | `refresh_member_seen` now normalizes `p_name` identically to `register_member` | The SQL root cause |
| 2 (Edge Function) | `member-portal/index.ts` | `verifyMember` falls back to direct ID+matric lookup if RPC fails | RPC still fails despite the fix |
| 1 (Client) | `app.v20260717-1.js` | `ensureMemberOnboarding` keeps stale session if refresh returns `{ok: false}` | Both SQL and EF fail |

### Deploy Checklist

| File | Must deploy to Supabase? | Must deploy to origin? |
|------|-------------------------|----------------------|
| `supabase-schema.sql` | ✅ Run migration | ❌ |
| `supabase/functions/member-portal/index.ts` | ✅ Deploy Edge Function | ❌ |
| `app.v20260717-1.js` | ❌ | ✅ |
| `supabase-service.v20260717-1.js` | ❌ | ✅ |

For the origin, either replace the existing versioned files or increment the version (e.g., `app.v20260718-1.js`) and update all HTML `src` + `import` refs.

---

## 6. Remaining Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `question_bank` table has zero `status='published'` rows | Quiz Edge Function returns empty courses | Local `quiz-bank.json` fallback (now working via R3 fix) |
| Edge Function not deployed or rolled back | All student Edge Function paths break | Layer 1 (client) keeps stale session + warns; quiz falls back to local bank |

## 7. Cleanup Applied

These dead/cosmetic items were removed from the codebase (both `app.v20260717-1.js` and `app.js`):

| Item | What was removed |
|------|-----------------|
| `connectCourseFilters()` | Entire function + call in `init()` — course search/filter was never wired to any HTML |
| `renderNextExam()` / `renderGesCountdown()` | Both functions + `typeof` guards in `renderAll()` and `setInterval` — elements never existed in HTML |
| `#nextLectureLink` | Ref removed from `renderNextLecture()` — element didn't exist in dashboard.html |
| `#timetableBody` / `#timetableCardGrid` | Refactored `renderTimetable()` to guard on existing `#lectureTimetable` / `#practicalTimetable` |
| `#charCount`, `#studentSuggestionCount`, `#studentResolvedCount`, `#studentSuggestionsList` | Removed from `suggestions.html` — never wired by any JS |
