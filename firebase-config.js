/* FIREBASE CONFIG:
   Replace these placeholder values with the web app config from your Firebase console.
   Keep the same values in firebase-messaging-sw.js because service workers cannot import
   this browser module on every hosting platform. */
export const firebaseConfig = {
  apiKey: "AIzaSyAH6qYNNXhBSbXtP7bkxgPsymsn56xnrVE",
  authDomain: "k29-physiology.firebaseapp.com",
  projectId: "k29-physiology",
  storageBucket: "k29-physiology.firebasestorage.app",
  messagingSenderId: "326148591423",
  appId: "1:326148591423:web:a899ee54e3a9605a708d8a",
  measurementId: "G-Y8N90ENEYN",
};

/* FCM VAPID KEY:
   Generate this in Firebase Console > Project settings > Cloud Messaging > Web push certificates. */
export const firebaseVapidKey = "PASTE_FIREBASE_WEB_PUSH_VAPID_KEY";

/* Cloud Functions region. Keep this in sync with functions/index.js. */
export const firebaseFunctionRegion = "us-central1";

export function isFirebaseConfigured() {
  return !Object.values(firebaseConfig).some((value) => value.startsWith("PASTE_"));
}
