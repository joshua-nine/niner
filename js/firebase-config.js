/*
  ╔══════════════════════════════════════════════════════════╗
  ║          FIREBASE SETUP — READ THIS FIRST                ║
  ╠══════════════════════════════════════════════════════════╣
  ║  1. Go to https://console.firebase.google.com            ║
  ║  2. Click "Add project" and give it a name               ║
  ║  3. In Project Settings > General, scroll to             ║
  ║     "Your apps" and click the </> (Web) icon             ║
  ║  4. Register your app, copy the firebaseConfig object    ║
  ║  5. Replace the placeholder values below                 ║
  ║  6. In Firebase Console:                                 ║
  ║     • Build > Authentication > Get started               ║
  ║       → Enable "Email/Password"                          ║
  ║     • Build > Firestore Database > Create database       ║
  ║       → Start in "test mode" (you can lock it down later)║
  ╚══════════════════════════════════════════════════════════╝
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── REPLACE THESE WITH YOUR OWN FIREBASE CONFIG ──────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ─────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
