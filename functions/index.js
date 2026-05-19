const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const REGION = "us-central1";

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeMatric(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function assertMemberInput(name, matricNumber) {
  if (name.length < 3) {
    throw new HttpsError("invalid-argument", "Enter your full name.");
  }

  if (!/^[A-Z0-9/-]{3,24}$/.test(matricNumber)) {
    throw new HttpsError("invalid-argument", "Enter a valid matric number.");
  }
}

async function verifyMemberSession(memberId, sessionToken) {
  if (!memberId || !sessionToken) {
    throw new HttpsError("unauthenticated", "Missing member session.");
  }

  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Member profile was not found.");
  }

  const expectedHash = memberSnap.get("sessionTokenHash");
  if (!expectedHash || expectedHash !== hash(sessionToken)) {
    throw new HttpsError("permission-denied", "Member session is not valid.");
  }

  return { memberRef, member: memberSnap.data() };
}

async function getEnabledTokens() {
  const tokenSnap = await db.collection("pushTokens").where("enabled", "==", true).get();
  return tokenSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((item) => item.token);
}

async function sendPortalNotification({ title, body, data }) {
  const tokens = await getEnabledTokens();
  if (!tokens.length) return;

  const messaging = admin.messaging();
  const chunks = [];
  for (let index = 0; index < tokens.length; index += 500) {
    chunks.push(tokens.slice(index, index + 500));
  }

  for (const chunk of chunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk.map((item) => item.token),
      notification: { title, body },
      data,
      webpush: {
        notification: {
          icon: "/assets/ui-logo.jpeg",
          badge: "/assets/ui-logo.jpeg",
        },
      },
    });

    const cleanup = response.responses
      .map((result, index) => ({ result, tokenDoc: chunk[index] }))
      .filter(({ result }) => {
        const code = result.error && result.error.code;
        return (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        );
      })
      .map(({ tokenDoc }) => db.collection("pushTokens").doc(tokenDoc.id).delete());

    await Promise.all(cleanup);
  }
}

exports.registerMember = onCall({ region: REGION }, async (request) => {
  const name = normalizeName(request.data && request.data.name);
  const matricNumber = normalizeMatric(request.data && request.data.matricNumber);
  assertMemberInput(name, matricNumber);

  const memberId = hash(matricNumber).slice(0, 32);
  const sessionToken = createSessionToken();
  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await memberRef.set(
    {
      name,
      matricNumber,
      notificationEnabled: memberSnap.get("notificationEnabled") || false,
      sessionTokenHash: hash(sessionToken),
      createdAt: memberSnap.exists ? memberSnap.get("createdAt") : now,
      lastSeenAt: now,
    },
    { merge: true }
  );

  return { memberId, sessionToken };
});

exports.refreshMemberSession = onCall({ region: REGION }, async (request) => {
  const { memberRef } = await verifyMemberSession(
    request.data && request.data.memberId,
    request.data && request.data.sessionToken
  );

  await memberRef.update({
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

exports.savePushToken = onCall({ region: REGION }, async (request) => {
  const token = String((request.data && request.data.token) || "").trim();
  if (!token) {
    throw new HttpsError("invalid-argument", "Missing push token.");
  }

  const { memberRef, member } = await verifyMemberSession(
    request.data && request.data.memberId,
    request.data && request.data.sessionToken
  );

  const tokenId = hash(token).slice(0, 40);
  await db.collection("pushTokens").doc(tokenId).set(
    {
      token,
      memberId: memberRef.id,
      name: member.name,
      matricNumber: member.matricNumber,
      enabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await memberRef.update({
    notificationEnabled: true,
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

exports.onResourceCreated = onDocumentCreated(
  { region: REGION, document: "resources/{resourceId}" },
  async (event) => {
    const resource = event.data && event.data.data();
    if (!resource) return;

    await sendPortalNotification({
      title: `New ${resource.type || "resource"}: ${resource.courseCode || "Class"}`,
      body: resource.title || "A new class resource was uploaded.",
      data: {
        type: "resource",
        resourceId: event.params.resourceId,
        url: "/courses.html",
      },
    });
  }
);

exports.onAnnouncementCreated = onDocumentCreated(
  { region: REGION, document: "announcements/{announcementId}" },
  async (event) => {
    const announcement = event.data && event.data.data();
    if (!announcement) return;

    await sendPortalNotification({
      title: announcement.title || "New class announcement",
      body: announcement.message || "A new announcement was posted.",
      data: {
        type: "announcement",
        announcementId: event.params.announcementId,
        url: "/dashboard.html",
      },
    });
  }
);
