# Executive Portal Migration Notes

## Overview

These notes document how the PhysioK29 monolith was split into two separate applications sharing the same Supabase backend:

1. **Student Portal** — `app.v20260717-1.js` (stripped of all executive code)
2. **Executive Portal** — `executive.v20260717-1.js` (extracted from the monolith)

## Architecture

```
┌────────────────────┐     ┌──────────────────────┐
│   Student Portal   │     │   Executive Portal   │
│  app.v20260717-1.js│     │executive.v20260717-1 │
│                    │     │         .js          │
│  ┌──────────────┐  │     │                      │
│  │  state       │──┼─────┼──> window.__PHYSIOK29 │
│  │  backend     │──┼─────┼──> _STATE__ /        │
│  └──────────────┘  │     │    __PHYSIOK29_      │
│                    │     │    _BACKEND__        │
└────────────────────┘     └──────────────────────┘
         │                           │
         └──────────┬───────────────┘
                    ▼
         ┌──────────────────────┐
         │   Supabase Backend   │
         │  (shared project)    │
         └──────────────────────┘
```

## File Structure

```
/
├── app.v20260717-1.js         ← Student-only module (exec stubs removed)
├── executive.v20260717-1.js   ← All executive functions
├── app.js                     ← Non-versioned mirror of app.v20260717-1.js
├── supabase-service.v20260717-1.js   ← Backend service (shared)
├── supabase-config.v20260717-1.js    ← Config (shared)
├── data.v20260717-1.js               ← Course data (shared)
├── K29.admin/
│   └── index.html             ← Loads app.v20260717-1.js + executive.v20260717-1.js
├── K29.rep/
│   └── index.html             ← Loads app.v20260717-1.js + executive.v20260717-1.js
├── OneSignalSDKWorker.js      ← SW caches both app and exec modules
└── _executive-portal/         ← Standalone Executive Portal package
    ├── docs/
    │   ├── AUTH.md
    │   ├── DATABASE.md
    │   ├── DESIGN_LANGUAGE.md
    │   ├── EDGE_FUNCTIONS.md
    │   ├── FEATURES_INVENTORY.md
    │   ├── MIGRATION_NOTES.md  (this file)
    │   └── STORAGE.md
    ├── constants/
    │   ├── COURSE_DATA.js
    │   └── SHARED_CONSTANTS.js
    ├── utils/
    │   ├── helpers.js
    │   ├── session.js
    │   └── supabase-client.js
    ├── components/
    ├── design-system/
    └── executive-source/
```

## Bridge Protocol

The two modules communicate through `window` bridges set up by `app.v20260717-1.js`:

```js
// In app.v20260717-1.js init():
window.__PHYSIOK29_STATE__ = state;
window.__PHYSIOK29_BACKEND__ = state.backend;
```

```js
// In executive.v20260717-1.js:
const _state = window.__PHYSIOK29_STATE__ || {};
const _backend = window.__PHYSIOK29_BACKEND__;
```

## What Was Changed

### `app.v20260717-1.js`
- All 31 executive-only function bodies replaced with no-op stubs
- Removed 10 exec-only calls from `init()`:
  - `connectStaffPortal`, `connectRepForms`, `connectGenericBulkUpload`
  - `connectStaffActions`, `connectStaffAnalytics`, `connectStaffTabs`
  - `connectMembersPdfDownload`, `connectAnalyticsPdfDownload`
  - `connectMembersCsvExport`, `loadBirthdayList`
- Added `window.__PHYSIOK29_STATE__` and `window.__PHYSIOK29_BACKEND__` bridges
- Student-only functions remain intact

### `app.js`
- Same changes as `app.v20260717-1.js` (non-versioned mirror)

### `executive.v20260717-1.js`
- Fixed `await import()` inside non-async arrow functions (`connectAnalyticsPdfDownload`, `connectMembersPdfDownload`)
- Changed click handlers to `async () =>` with try/catch

### `K29.admin/index.html` and `K29.rep/index.html`
- Added `<script type="module" src="./executive.v20260717-1.js"></script>` after the `app.v20260717-1.js` script tag

### `OneSignalSDKWorker.js`
- Added `/executive.v20260717-1.js` to the `APP_SHELL_URLS` pre-cache list

## Stubbed Functions in `app.v20260717-1.js`

These function bodies were replaced with `{ /* stub — moved to executive.v20260717-1.js */ }`:

| Function | Purpose |
|---|---|
| `canEditResource()` | Permission check |
| `canEditAnnouncement()` | Permission check |
| `renderMembersTable()` | Staff member list |
| `renderStaffLists()` | Staff resource/announcement/suggestion lists |
| `renderAdminDashboard()` | Admin overview |
| `renderStaffSummary()` | Staff metric cards |
| `renderStaffMonitor()` | Staff resource monitor |
| `renderStaffStudyFilters()` | Study analytics filters |
| `renderMemberStudyHistory()` | Member quiz history |
| `renderStaffStudyAnalytics()` | Study analytics grid + leaderboard |
| `findPossibleDuplicate()` | Duplicate file detection |
| `connectStaffPortal()` | Staff auth + portal init |
| `connectRepForms()` | Upload + announcement forms |
| `connectGenericBulkUpload()` | Bulk file upload |
| `openEditResourceModal()` | Edit resource modal |
| `openEditAnnouncementModal()` | Edit announcement modal |
| `openSuggestionModal()` | View suggestion modal |
| `showFormModal()` | Generic form modal |
| `connectStaffActions()` | Staff action handlers |
| `connectStaffAnalytics()` | Staff analytics chart connections |
| `connectStaffTabs()` | Staff tab navigation |
| `connectMembersPdfDownload()` | Members PDF export |
| `connectAnalyticsPdfDownload()` | Analytics PDF export |
| `setMetricText()` | Update metric DOM elements |
| `renderWeeklyActivityChart()` | Canvas bar chart |
| `renderEngagementRing()` | Canvas donut chart |
| `renderRepSummary()` | Rep metric cards |
| `connectMembersCsvExport()` | Members CSV export |
| `loadBirthdayList()` | Birthday data loading |
| `getUpcomingBirthdays()` | Birthday filtering |
| `triggerBirthdayNotification()` | Birthday test notification |
| `renderBirthdayManager()` | Birthday manager modal |

## Student Functions Kept in `app.v20260717-1.js`

These functions remain and are used by both portals (accessed via the state bridge):

- `getMemberStreak()` — Streak calculation
- `summarizeMemberStudy()` — Student study summary
- `formatDate()` / `formatDuration()` / `formatScorePercent()` — Date/score formatting
- `getMemberSession()` / `saveMemberSession()` / `clearMemberSession()` — Session management
- `ensureBirthdayOnboarding()` — Birthday onboarding modal
- `renderBirthdayPhotoSettings()` — Birthday photo settings UI

## Verification Checklist

After changes are deployed:

1. [ ] Student pages load without console errors
2. [ ] Quiz, exam, reader, timetable work for students
3. [ ] `K29.admin/index.html` shows login panel, then admin dashboard after sign-in
4. [ ] `K29.rep/index.html` shows login panel, then rep dashboard after sign-in
5. [ ] Resource upload works in admin/rep portals
6. [ ] Announcement posting works
7. [ ] Member list renders with delete controls (admin only)
8. [ ] Study analytics charts render
9. [ ] Birthday manager opens and shows profiles
10. [ ] CSV and PDF exports work in admin portal
11. [ ] Service worker caches `executive.v20260717-1.js` (check offline)

## If Something Breaks

1. Check `window.__PHYSIOK29_STATE__` is set (should contain `members`, `resources`, etc.)
2. Check `window.__PHYSIOK29_BACKEND__` is set (should be a SupabaseService instance)
3. Verify `executive.v20260717-1.js` loads in Network tab of DevTools
4. Compare with `app.v20260717-1.js` — ensure no exec function body leaked through
