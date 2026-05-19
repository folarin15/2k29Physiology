# Physiology 2k29 Class Portal

This is a vanilla HTML/CSS/JS portal that can be hosted on Pxxl while Firebase handles the backend.

## What Firebase Handles

- Firestore: resources, announcements, member list, roles, push tokens.
- Firebase Storage: uploaded class files.
- Firebase Auth: Ayanfe, Raphael, and admin login.
- Firebase Functions: member registration, session refresh, push-token saving, and notification triggers.
- Firebase Cloud Messaging: browser notifications for new uploads and announcements.

## Setup Checklist

1. Create a Firebase project.
2. Add a web app in Firebase Console and copy the config into:
   - `firebase-config.js`
   - `firebase-messaging-sw.js`
3. Generate a Web Push certificate in Firebase Console and paste the public VAPID key into `firebase-config.js`.
4. Enable Firebase Auth email/password.
5. Create Firebase Auth users for:
   - you as admin
   - Ayanfe as rep
   - Raphael as rep
6. In Firestore, create `roles/{uid}` documents for those Auth users:

```json
{
  "role": "admin",
  "displayName": "Akinteye"
}
```

```json
{
  "role": "rep",
  "displayName": "Ayanfe"
}
```

```json
{
  "role": "rep",
  "displayName": "Raphael"
}
```

7. Deploy backend rules and functions:

```bash
firebase deploy --only functions,firestore:rules,storage
```

8. Upload the frontend files to Pxxl. Make sure `firebase-messaging-sw.js` is served from the site root.

## Important Files

- `dashboard.html`: student dashboard and live announcements.
- `courses.html`: course list plus live resource counts.
- `rep.html`: protected upload and announcement portal.
- `admin.html`: protected admin portal.
- `app.js`: frontend rendering and event wiring.
- `firebase-service.js`: Firebase client wrapper.
- `functions/index.js`: secure server logic and notification triggers.
- `firestore.rules`: Firestore permissions.
- `storage.rules`: Firebase Storage permissions.

## Local Preview

The frontend renders without Firebase config, but live uploads, login, member registration, and notifications require deployed Firebase services.
