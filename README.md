# PhysioK29

Vanilla HTML/CSS/JS portal for Physiology Class 2k29, hosted on Pxxl with Supabase as the backend.

## Public Links

- `dashboard.html`: dashboard, latest resources, and announcements.
- `courses.html`: first-semester course resource bank.
- `timetable.html`: GES/GST CBT timetable with CSV download.
- `reps.html`: Ayanfe/Raphael contacts and WhatsApp links.
- `suggestions.html`: student suggestion form.

## Staff Links

These are intentionally not shown in the public navigation:

- `K29.rep/`: course rep workspace.
- `K29.admin/`: admin workspace.

The older `rep.html` and `admin.html` files remain for compatibility, but share `K29.rep/` and `K29.admin/` with staff.

## Supabase

- Auth: admin and rep login.
- Storage: uploaded class files.
- Database: members, resources, announcements, suggestions, and staff roles.
- Realtime: live in-site updates while the portal is open.

Run `supabase-schema.sql` in Supabase SQL Editor after pulling updates.

## Sharing

The WhatsApp/social preview image is `assets/og-image.png`, and the favicon/app icon is `assets/favicon.png`.

When the final Pxxl URL is known, update the `og:image` tags to the absolute image URL if WhatsApp does not preview it automatically, for example:

```html
<meta property="og:image" content="https://your-pxxl-site.com/assets/og-image.png" />
```

## Push Notifications

The portal currently has live in-site toasts for new resources, announcements, and suggestions. True background push needs a push sender:

- easiest: OneSignal Web Push
- more custom: Supabase Edge Functions + web-push

Do not build background push directly into static frontend-only code; it needs a trusted server-side sender.
