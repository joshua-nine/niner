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
  apiKey:            "AIzaSyBSWFYfRiSw4n-UYwszaGKTjvdPjlTyPjc",
  authDomain:        "dcc-campaign.firebaseapp.com",
  projectId:         "dcc-campaign",
  storageBucket:     "dcc-campaign.firebasestorage.app",
  messagingSenderId: "328123402638",
  appId:             "1:328123402638:web:df0027e87e5fa277fb3cdf",
  measurementId:     "G-BFT9RX75D0"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
