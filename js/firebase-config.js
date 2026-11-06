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

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAzGR2d9TlFTDCSDM0V9uTm4E4XjqfYu4w",
  authDomain:        "dragon-8170d.firebaseapp.com",
  projectId:         "dragon-8170d",
  storageBucket:     "dragon-8170d.firebasestorage.app",
  messagingSenderId: "169416444296",
  appId:             "1:169416444296:web:a4ed0ad2974d40292b523d",
  measurementId:     "G-S9HXVRSWHC"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
