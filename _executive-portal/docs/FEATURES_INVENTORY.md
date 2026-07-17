# PhysioK29 — Executive Features Inventory

This document lists every executive feature removed from the student portal during refactoring.
Each entry includes the feature's purpose, original implementation files, database tables, storage, Edge Functions, APIs, and dependencies.

---

## Auth & Session

### 1. Staff Authentication (Email/Password)
- **Purpose**: Sign in/out for admin and rep users via Supabase Auth
- **Files**: `supabase-service.v20260717-1.js` (signInRep, signOutRep, onAuth, getRole)
- **Tables**: `auth.users`, `staff_roles`
- **Edge Functions**: None (uses Supabase Auth directly)
- **APIs**: `supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`
- **Dependencies**: Supabase JS client
- **Exec Type**: Staff (admin + rep)

### 2. Staff Role Detection
- **Purpose**: Determine if current user is admin, rep, or student
- **Files**: `app.v20260717-1.js` (connectStaffPortal, isAdminPortal, isStaffPortal)
- **Tables**: `staff_roles`
- **Dependencies**: Supabase Auth
- **Exec Type**: Staff (admin + rep)

---

## Resource Management

### 3. Resource Upload
- **Purpose**: Upload course materials (PDF, PPT, DOC, images) to storage + database
- **Files**: `app.v20260717-1.js` (connectRepForms uploadForm handler), `supabase-service.v20260717-1.js` (uploadResource), `K29.admin/index.html`, `K29.rep/index.html`
- **Tables**: `resources`
- **Storage**: `class-resources` bucket
- **Edge Functions**: `send-portal-notification`
- **APIs**: `supabase.storage.from('class-resources').upload()`
- **Dependencies**: Supabase Auth, storage SDK, file type validation (`.pdf`, `.ppt`, `.pptx`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`)
- **Exec Type**: Staff (admin + rep)

### 4. Lecture Upload
- **Purpose**: Upload weekly lecture materials with metadata (week, date, topic, venue)
- **Files**: `app.v20260717-1.js` (same form as resource upload, type toggle)
- **Tables**: `resources` (upload_category = 'lecture')
- **Storage**: `class-resources`
- **Exec Type**: Staff (admin + rep)

### 5. AI Auto-Title Generation
- **Purpose**: Auto-generate resource title and description using AI
- **Files**: `app.v20260717-1.js` (generateResourceDetails)
- **Edge Functions**: `generate-resource-details`
- **Exec Type**: Staff (admin + rep)

### 6. Duplicate Detection
- **Purpose**: Warn if uploaded file already exists in a course
- **Files**: `app.v20260717-1.js` (findPossibleDuplicate)
- **Exec Type**: Staff (admin + rep)

### 7. Resource Edit
- **Purpose**: Edit resource title, type, note, display filename
- **Files**: `app.v20260717-1.js` (openEditResourceModal), `supabase-service.v20260717-1.js` (updateResource)
- **Tables**: `resources`
- **Exec Type**: Staff (admin + rep, owner-scoped)

### 8. Resource Delete
- **Purpose**: Delete resource from storage + database
- **Files**: `app.v20260717-1.js` (deleteResource handler), `supabase-service.v20260717-1.js` (deleteResource)
- **Tables**: `resources`
- **Storage**: `class-resources`
- **Exec Type**: Staff (admin + rep, owner-scoped)

### 9. Resource Management Table
- **Purpose**: Search, filter, sort, and manage all resources in a table view
- **Files**: `app.v20260717-1.js` (renderStaffLists → resources section), `K29.admin/index.html` (#staffManage)
- **Tables**: `resources`
- **Exec Type**: Admin

### 10. Resource Analytics Monitor
- **Purpose**: Per-course resource counts, recent upload activity feed
- **Files**: `app.v20260717-1.js` (renderStaffMonitor)
- **Tables**: `resources`
- **Exec Type**: Admin

---

## Announcement Management

### 11. Announcement Post
- **Purpose**: Create announcements with priority levels
- **Files**: `app.v20260717-1.js` (connectRepForms announcementForm handler), `supabase-service.v20260717-1.js` (postAnnouncement)
- **Tables**: `announcements`
- **Edge Functions**: `send-portal-notification`
- **Exec Type**: Staff (admin + rep)

### 12. Announcement Edit
- **Purpose**: Edit announcement title, message, priority
- **Files**: `app.v20260717-1.js` (openEditAnnouncementModal), `supabase-service.v20260717-1.js` (updateAnnouncement)
- **Tables**: `announcements`
- **Exec Type**: Staff (admin + rep, owner-scoped)

### 13. Announcement Delete
- **Purpose**: Delete announcements
- **Files**: `app.v20260717-1.js` (deleteAnnouncement handler), `supabase-service.v20260717-1.js` (deleteAnnouncement)
- **Tables**: `announcements`
- **Exec Type**: Staff (admin + rep, owner-scoped)

### 14. Announcement Management Table
- **Purpose**: Full announcement table with edit/delete controls
- **Files**: `app.v20260717-1.js` (renderStaffLists → announcements section), `K29.admin/index.html` (#staffManage)
- **Tables**: `announcements`
- **Exec Type**: Admin

---

## Member Management

### 15. Members Table View
- **Purpose**: View all registered members with name, matric, push status, streak, last seen
- **Files**: `app.v20260717-1.js` (renderMembersTable), `K29.admin/index.html`, `K29.rep/index.html`
- **Tables**: `members`, `study_events` (indirect for streak)
- **Exec Type**: Staff (admin + rep)

### 16. Member Delete
- **Purpose**: Remove a member and all associated data (cascading)
- **Files**: `app.v20260717-1.js` (deleteMember handler, data-delete-member button), `supabase-service.v20260717-1.js` (deleteMember)
- **Tables**: `members`, `resource_progress`, `resource_feedback`, `quiz_attempts`, `study_events`, `topic_performance`
- **Exec Type**: Admin only

### 17. Member Study History
- **Purpose**: View a member's quiz/exam attempts, topic performance, and study events
- **Files**: `app.v20260717-1.js` (renderMemberStudyHistory)
- **Tables**: `quiz_attempts`, `quiz_answers`, `topic_performance`, `study_events`
- **Exec Type**: Admin only

### 18. Member CSV Export
- **Purpose**: Download member list as CSV file
- **Files**: `app.v20260717-1.js` (connectMembersCsvExport)
- **Tables**: `members`
- **Exec Type**: Admin

### 19. Member PDF Export
- **Purpose**: Download member list as PDF
- **Files**: `app.v20260717-1.js` (connectMembersPdfDownload)
- **Exec Type**: Admin

---

## Suggestion Management

### 20. Suggestions Board
- **Purpose**: View, search, filter, and manage student suggestions
- **Files**: `app.v20260717-1.js` (renderStaffLists → suggestions section), `K29.admin/index.html` (#staffSuggestions)
- **Tables**: `suggestions`
- **Exec Type**: Admin (full), Rep (view only)

### 21. Suggestion Detail View
- **Purpose**: Open suggestion modal to read full message
- **Files**: `app.v20260717-1.js` (openSuggestionModal)
- **Exec Type**: Staff (admin + rep)

### 22. Suggestion Delete
- **Purpose**: Delete suggestions
- **Files**: `app.v20260717-1.js` (deleteSuggestion handler), `supabase-service.v20260717-1.js` (deleteSuggestion)
- **Tables**: `suggestions`
- **Exec Type**: Admin only

---

## Analytics & Monitoring

### 23. Admin Dashboard Metrics
- **Purpose**: Time-based greeting, 6 metric cards (members, resources, quizzes, streak, active, announcements)
- **Files**: `app.v20260717-1.js` (renderAdminDashboard → metrics), `K29.admin/index.html` (#adminMetricRow)
- **Tables**: `members`, `resources`, `quiz_attempts`, `announcements`
- **Exec Type**: Admin

### 24. Admin Dashboard Cards
- **Purpose**: 6 insight cards (Upload, Members, Quiz & Exam, Streak Board, Most Active, Suggestions)
- **Files**: `app.v20260717-1.js` (renderAdminDashboard → cardGrid), `K29.admin/index.html` (#adminCardGrid)
- **Exec Type**: Admin

### 25. Weekly Activity Chart
- **Purpose**: Bar chart showing daily active members over the past week
- **Files**: `app.v20260717-1.js` (renderWeeklyActivityChart)
- **Tables**: `study_events`
- **Exec Type**: Admin

### 26. Engagement Ring
- **Purpose**: Donut chart showing resource engagement distribution
- **Files**: `app.v20260717-1.js` (renderEngagementRing)
- **Exec Type**: Admin

### 27. Staff Summary Metrics
- **Purpose**: Summary cards: uploads this week, most-opened course, push-off count, helpful votes, active students, top streak
- **Files**: `app.v20260717-1.js` (renderStaffSummary)
- **Tables**: `resources`, `members`, `resource_feedback`, `study_events`, `resource_progress`
- **Exec Type**: Staff (admin + rep)

### 28. Study Analytics
- **Purpose**: Quiz/exam statistics, leaderboard, engagement distribution
- **Files**: `app.v20260717-1.js` (renderStaffStudyAnalytics)
- **Tables**: `quiz_attempts`, `quiz_answers`, `topic_performance`, `study_events`
- **Exec Type**: Admin

### 29. Analytics PDF Export
- **Purpose**: Download study analytics report as PDF
- **Files**: `app.v20260717-1.js` (connectAnalyticsPdfDownload)
- **Exec Type**: Admin

### 30. Rep Summary
- **Purpose**: Rep-specific metrics: own uploads, own posts, pending suggestions
- **Files**: `app.v20260717-1.js` (renderRepSummary), `K29.rep/index.html` (.rep-summary-grid)
- **Tables**: `resources`, `announcements`, `suggestions`
- **Exec Type**: Rep only

---

## Push Notifications

### 31. Push Notification Trigger
- **Purpose**: Send OneSignal push notification after resource upload or announcement post
- **Files**: `supabase-service.v20260717-1.js` (notifyPortal, tryNotifyPortal)
- **Edge Functions**: `send-portal-notification`
- **APIs**: OneSignal SDK (via Edge Function)
- **Exec Type**: Staff (admin + rep)

---

## Bulk Operations

### 32. Bulk Upload
- **Purpose**: Upload multiple files via directory selection or ZIP archive
- **Files**: `app.v20260717-1.js` (connectGenericBulkUpload), `K29.admin/index.html` (#staffBulkUpload)
- **Tables**: `resources`
- **Storage**: `class-resources`
- **Exec Type**: Admin only

---

## Birthday Management

### 33. Birthday Manager Dashboard Card
- **Purpose**: Admin card showing upcoming birthday counts
- **Files**: `app.v20260717-1.js` (renderBirthdayDashboard)
- **Tables**: `members`
- **Exec Type**: Admin

### 34. Birthday Manager Modal
- **Purpose**: Full birthday management with search, month filter, photo download, test notification
- **Files**: `app.v20260717-1.js` (renderBirthdayManager, triggerBirthdayNotification)
- **Tables**: `members`, `birthday_notifications`
- **Edge Functions**: `birthday-notify`
- **Exec Type**: Admin

### 35. Birthday List Load
- **Purpose**: Fetch all birthday-registered members
- **Files**: `app.v20260717-1.js` (loadBirthdayList), `supabase-service.v20260717-1.js` (getBirthdayList)
- **Tables**: `members`
- **Exec Type**: Admin

---

## Data Watchers (Staff-Only)

### 36. Watcher: Members
- **Purpose**: Real-time member list updates
- **Files**: `supabase-service.v20260717-1.js` (watchMembers)
- **Tables**: `members`
- **Exec Type**: Staff (admin + rep)

### 37. Watcher: Suggestions
- **Purpose**: Real-time suggestion list updates
- **Files**: `supabase-service.v20260717-1.js` (watchSuggestions)
- **Tables**: `suggestions`
- **Exec Type**: Staff (admin + rep)

### 38. Watcher: Resource Progress
- **Purpose**: Real-time reading progress updates
- **Files**: `supabase-service.v20260717-1.js` (watchResourceProgress)
- **Tables**: `resource_progress`
- **Exec Type**: Staff (admin + rep)

### 39. Watcher: Resource Feedback
- **Purpose**: Real-time feedback updates
- **Files**: `supabase-service.v20260717-1.js` (watchResourceFeedback)
- **Tables**: `resource_feedback`
- **Exec Type**: Staff (admin + rep)

### 40. Watcher: Study Events
- **Purpose**: Real-time study event stream
- **Files**: `supabase-service.v20260717-1.js` (watchStudyEvents)
- **Tables**: `study_events`
- **Exec Type**: Staff (admin + rep)

### 41. Watcher: Quiz Attempts
- **Purpose**: Real-time quiz attempt monitoring
- **Files**: `supabase-service.v20260717-1.js` (watchQuizAttempts)
- **Tables**: `quiz_attempts`
- **Exec Type**: Admin

### 42. Watcher: Topic Performance
- **Purpose**: Real-time topic accuracy tracking
- **Files**: `supabase-service.v20260717-1.js` (watchTopicPerformance)
- **Tables**: `topic_performance`
- **Exec Type**: Admin

---

## Nav & Routing

### 43. Staff Tab Navigation
- **Purpose**: Tab-based navigation for admin (8 tabs) and rep (6 tabs) portals
- **Files**: `app.v20260717-1.js` (connectStaffTabs), `K29.admin/index.html`, `K29.rep/index.html`
- **Exec Type**: Staff (admin + rep)

---

## CSS & Design

### 44. Admin-Specific Styles
- **Purpose**: Dashboard layout, metric cards, cards grid, analytics charts, monitor panels, bulk upload, resource management, suggestions workspace
- **Files**: `styles.css`
- **Exec Type**: Admin

### 45. Rep-Specific Styles
- **Purpose**: Rep summary grid, rep cards, rep metrics
- **Files**: `styles.css`
- **Exec Type**: Rep

---

## Summary

| Category | Features | Admin | Rep | Shared |
|----------|----------|-------|-----|--------|
| Auth | 2 | ✓ | ✓ | — |
| Resource Management | 8 | ✓ | ✓ | — |
| Announcements | 4 | ✓ | ✓ | — |
| Member Management | 5 | 4 | 1 | — |
| Suggestions | 3 | 3 | 2 | — |
| Analytics | 8 | 7 | 1 | — |
| Push Notifications | 1 | ✓ | ✓ | — |
| Bulk Ops | 1 | ✓ | — | — |
| Birthday | 3 | 3 | — | — |
| Data Watchers | 7 | 7 | 5 | — |
| Nav & Routing | 1 | ✓ | ✓ | — |
| CSS | 2 | ✓ | ✓ | — |

**Total executive features: 45**
- Admin only: ~12
- Rep only: ~2
- Shared (admin + rep): ~31
