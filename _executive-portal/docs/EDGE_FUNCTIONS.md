# PhysioK29 — Edge Function Documentation

All Edge Functions are deployed on Supabase and accessed via `https://{ref}.supabase.co/functions/v1/{name}`.

---

## `member-portal`
- **Entry**: `supabase/functions/member-portal/index.ts`
- **Deployed**: Yes
- **Auth**: Service role key (internal), called via `supabase.functions.invoke()` from client

### Actions
| Action | Method | Auth | Description |
|--------|--------|------|-------------|
| `register` | POST | service_role | Register a new member (name + matric). Calls `register_member()` SQL function. Rate-limited to 12 attempts/10min per IP. |
| `refresh` | POST | service_role | Refresh member session. Calls `refresh_member_seen()` SQL function. Returns updated member data. |
| `portal-data` | POST | service_role | Returns all resources (with signed URLs) and announcements for the student dashboard. |
| `reader-resource` | POST | service_role | Returns single resource with signed URL + current progress. |
| `save-resource-progress` | POST | service_role | Updates/inserts reading progress. Creates study_events on first open or completion. |
| `save-resource-feedback` | POST | service_role | Upserts helpful/not-helpful feedback. Returns aggregate count. |
| `quiz-setup` | POST | service_role | Returns available courses/topics from question_bank + member's study summary. |
| `quiz-questions` | POST | service_role | Returns shuffled questions for a course/topic. |
| `submit-quiz-attempt` | POST | service_role | Grades answers, creates attempt record, updates topic_performance, creates study_events. |
| `submit-suggestion` | POST | service_role | Inserts a suggestion from the member. |
| `save-push-status` | POST | service_role | Updates OneSignal push subscription. |
| `save-birthday-profile` | POST | service_role | Saves full_name, date_of_birth, birthday_photo_url, marks registration complete. |
| `get-birthday-profile` | POST | service_role | Returns the member's birthday profile. |

### Request Format
```json
{
  "action": "action-name",
  "memberSession": { "memberId": "...", "name": "...", "matricNumber": "..." },
  // action-specific fields
}
```

### CORS
Allowed origins: `https://2k29physiology.pxxl.click`, `http://localhost:4177`, `http://127.0.0.1:4177`

---

## `send-portal-notification`
**Purpose**: Sends push notifications via OneSignal to all subscribed members.

Called internally from `supabase-service.js` after:
- Resource upload (`tryNotifyPortal`)
- Announcement post (`tryNotifyPortal`)

---

## `generate-resource-details`
**Purpose**: AI-powered title and context generation for uploaded resources.

---

## `birthday-notify`
- **Entry**: `supabase/functions/birthday-notify/index.ts`
- **Deployed**: Yes
- **Purpose**: Daily check for upcoming birthdays. Queries members with `birthday_registration_completed = true`, calculates today/tomorrow/this-week birthdays, logs to `birthday_notifications` table, optionally sends WhatsApp webhook.
- **Scheduled via**: GitHub Actions (`.github/workflows/birthday-check.yml`) daily at 7AM

### Environment Variables
- `WHATSAPP_WEBHOOK_URL` — Optional WhatsApp Cloud API endpoint
- `WHATSAPP_TOKEN` — Optional WhatsApp API token

### Triggering
- **Cron**: Daily via GitHub Actions
- **Manual**: Via "Test Notification" button in admin Birthday Manager modal
