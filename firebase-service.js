import {
  firebaseConfig,
  firebaseFunctionRegion,
  firebaseVapidKey,
  isFirebaseConfigured,
} from "./firebase-config.js";

const FIREBASE_VERSION = "12.13.0";

let sdkPromise;

/* SDK LOADER: Loads Firebase only when config is present so local previews stay usable. */
async function loadFirebaseSdk() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-storage.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging.js`),
    ]);
  }

  const [appSdk, authSdk, firestoreSdk, storageSdk, functionsSdk, messagingSdk] = await sdkPromise;
  return { appSdk, authSdk, firestoreSdk, storageSdk, functionsSdk, messagingSdk };
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return Number(value) || 0;
}

function mapDoc(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAtMs: toMillis(data.createdAt),
    lastSeenAtMs: toMillis(data.lastSeenAt),
  };
}

function offlineNotice(methodName) {
  console.warn(`${methodName} skipped because Firebase is not configured yet.`);
}

/* BACKEND FACTORY: Exposes a small app-specific API over Firebase services. */
export async function createBackend() {
  const sdk = await loadFirebaseSdk();

  if (!sdk) {
    return {
      ready: false,
      signInRep: async () => {
        throw new Error("Add your Firebase config before signing in.");
      },
      signOutRep: async () => undefined,
      onAuth: (callback) => {
        callback(null, null);
        return () => undefined;
      },
      registerMember: async (profile) => ({
        memberId: `local-${profile.matricNumber}`,
        sessionToken: "local-preview-session",
      }),
      refreshMemberSession: async () => undefined,
      savePushToken: async () => undefined,
      requestNotificationAccess: async () => "unavailable",
      watchResources: (callback) => {
        offlineNotice("watchResources");
        callback([]);
        return () => undefined;
      },
      watchAnnouncements: (callback) => {
        offlineNotice("watchAnnouncements");
        callback([]);
        return () => undefined;
      },
      watchMembers: (callback) => {
        offlineNotice("watchMembers");
        callback([]);
        return () => undefined;
      },
      uploadResource: async () => {
        throw new Error("Add your Firebase config before uploading files.");
      },
      postAnnouncement: async () => {
        throw new Error("Add your Firebase config before posting announcements.");
      },
      deleteResource: async () => {
        throw new Error("Add your Firebase config before deleting resources.");
      },
      deleteAnnouncement: async () => {
        throw new Error("Add your Firebase config before deleting announcements.");
      },
    };
  }

  const { appSdk, authSdk, firestoreSdk, storageSdk, functionsSdk, messagingSdk } = sdk;
  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = firestoreSdk.getFirestore(app);
  const storage = storageSdk.getStorage(app);
  const functions = functionsSdk.getFunctions(app, firebaseFunctionRegion);

  const registerMemberFn = functionsSdk.httpsCallable(functions, "registerMember");
  const refreshMemberSessionFn = functionsSdk.httpsCallable(functions, "refreshMemberSession");
  const savePushTokenFn = functionsSdk.httpsCallable(functions, "savePushToken");

  async function getRole(uid) {
    if (!uid) return null;
    const roleRef = firestoreSdk.doc(db, "roles", uid);
    const roleSnap = await firestoreSdk.getDoc(roleRef);
    return roleSnap.exists() ? roleSnap.data() : null;
  }

  return {
    ready: true,

    async signInRep(email, password) {
      return authSdk.signInWithEmailAndPassword(auth, email, password);
    },

    async signOutRep() {
      return authSdk.signOut(auth);
    },

    onAuth(callback) {
      return authSdk.onAuthStateChanged(auth, async (user) => {
        const role = user ? await getRole(user.uid) : null;
        callback(user, role);
      });
    },

    async registerMember(profile) {
      const response = await registerMemberFn(profile);
      return response.data;
    },

    async refreshMemberSession(session) {
      if (!session?.memberId || !session?.sessionToken) return;
      await refreshMemberSessionFn(session);
    },

    async savePushToken(session, token) {
      await savePushTokenFn({
        memberId: session.memberId,
        sessionToken: session.sessionToken,
        token,
      });
    },

    async requestNotificationAccess(session) {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        return "unavailable";
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return permission;

      const messaging = messagingSdk.getMessaging(app);
      const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
      const token = await messagingSdk.getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        await this.savePushToken(session, token);
      }

      messagingSdk.onMessage(messaging, (payload) => {
        window.dispatchEvent(new CustomEvent("portal:message", { detail: payload }));
      });

      return token ? "granted" : "empty-token";
    },

    watchResources(callback, onError = console.error) {
      const resourcesQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "resources"),
        firestoreSdk.orderBy("createdAt", "desc"),
        firestoreSdk.limit(100)
      );

      return firestoreSdk.onSnapshot(
        resourcesQuery,
        (snapshot) => callback(snapshot.docs.map(mapDoc)),
        onError
      );
    },

    watchAnnouncements(callback, onError = console.error) {
      const announcementsQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "announcements"),
        firestoreSdk.orderBy("createdAt", "desc"),
        firestoreSdk.limit(40)
      );

      return firestoreSdk.onSnapshot(
        announcementsQuery,
        (snapshot) => callback(snapshot.docs.map(mapDoc)),
        onError
      );
    },

    watchMembers(callback, onError = console.error) {
      const membersQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "members"),
        firestoreSdk.orderBy("createdAt", "desc"),
        firestoreSdk.limit(300)
      );

      return firestoreSdk.onSnapshot(
        membersQuery,
        (snapshot) => callback(snapshot.docs.map(mapDoc)),
        onError
      );
    },

    async uploadResource(formData, file, onProgress) {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in as a course rep first.");

      const resourceRef = firestoreSdk.doc(firestoreSdk.collection(db, "resources"));
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `resources/${formData.courseCode}/${resourceRef.id}/${safeName}`;
      const fileRef = storageSdk.ref(storage, storagePath);
      const uploadTask = storageSdk.uploadBytesResumable(fileRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (!onProgress) return;
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(progress);
          },
          reject,
          resolve
        );
      });

      const downloadUrl = await storageSdk.getDownloadURL(fileRef);
      const role = await getRole(user.uid);

      await firestoreSdk.setDoc(resourceRef, {
        ...formData,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "unknown",
        storagePath,
        downloadUrl,
        uploadedBy: role?.displayName || user.email || "Course rep",
        uploadedByUid: user.uid,
        createdAt: firestoreSdk.serverTimestamp(),
      });

      return resourceRef.id;
    },

    async postAnnouncement(formData) {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in as a course rep first.");
      const role = await getRole(user.uid);

      await firestoreSdk.addDoc(firestoreSdk.collection(db, "announcements"), {
        ...formData,
        postedBy: role?.displayName || user.email || "Course rep",
        postedByUid: user.uid,
        createdAt: firestoreSdk.serverTimestamp(),
      });
    },

    async deleteResource(resource) {
      if (resource.storagePath) {
        await storageSdk.deleteObject(storageSdk.ref(storage, resource.storagePath)).catch(() => undefined);
      }
      await firestoreSdk.deleteDoc(firestoreSdk.doc(db, "resources", resource.id));
    },

    async deleteAnnouncement(announcementId) {
      await firestoreSdk.deleteDoc(firestoreSdk.doc(db, "announcements", announcementId));
    },
  };
}

export { sortByCreatedAt };
