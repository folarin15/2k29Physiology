/* FIREBASE MESSAGING SERVICE WORKER:
   Pxxl must publish this file at the site root. Keep config in sync with firebase-config.js. */
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyAH6qYNNXhBSbXtP7bkxgPsymsn56xnrVE",
  authDomain: "k29-physiology.firebaseapp.com",
  projectId: "k29-physiology",
  storageBucket: "k29-physiology.firebasestorage.app",
  messagingSenderId: "326148591423",
  appId: "1:326148591423:web:a899ee54e3a9605a708d8a",
  measurementId: "G-Y8N90ENEYN",
};

if (!firebaseConfig.apiKey.startsWith("PASTE_")) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "Physiology 2k29";
    const options = {
      body: payload.notification?.body || "New class update is available.",
      icon: "./assets/ui-logo.jpeg",
      badge: "./assets/ui-logo.jpeg",
      data: payload.data || {},
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("./dashboard.html"));
});
