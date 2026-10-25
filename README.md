# [NINER]SHEET

A D&D 5e character sheet and campaign tracker with a **Dungeon Crawler Carl**-inspired neon HUD aesthetic.

> Built by a veteran getting into tech — welcome to the dungeon.

## Features
- Full D&D 5e character sheets with auto-calculated modifiers, saving throws, skills, and passive perception
- Campaign tracker: session logs, NPC roster, locations, quest log
- Invite friends to shared campaigns
- Built-in dice roller (d4–d100, advantage/disadvantage, custom NdX+bonus)
- Auto-save to Firebase
- Multi-user accounts (email/password)

---

## Setup (Required — 5 minutes)

### 1. Create a free Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** and give it a name (e.g. `ninersheet`)
3. Disable Google Analytics if you don't need it, click **Create project**

### 2. Enable Authentication

1. In the left sidebar, click **Build → Authentication → Get started**
2. Click **Email/Password**, toggle it **Enabled**, and hit **Save**

### 3. Create Firestore Database

1. Click **Build → Firestore Database → Create database**
2. Choose **Start in test mode** (you can add security rules later)
3. Pick a region and click **Done**

### 4. Get your Firebase config

1. Click the **gear icon** (top-left) → **Project settings**
2. Scroll down to **"Your apps"** → click the **`</>`** (Web) icon
3. Register your app (nickname e.g. `ninersheet-web`)
4. Copy the `firebaseConfig` object shown

### 5. Paste your config

Open `js/firebase-config.js` and replace the placeholder values with your own:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
```

### 6. Run the site

Open `index.html` in a browser. Because Firebase uses ES modules, you need to serve the files via a local web server (not just open the file directly).

**Easy options:**
- **VS Code**: Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), right-click `index.html` → **Open with Live Server**
- **Python**: `python3 -m http.server 8080` then open `http://localhost:8080`
- **Node.js**: `npx serve .` then open the URL shown

---

## Firestore Security Rules (Optional — Recommended before sharing)

In Firebase Console → Firestore → **Rules**, replace the default with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    match /characters/{charId} {
      allow read, write: if request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null;
    }

    match /campaigns/{campId} {
      allow read, write: if request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }

    match /invites/{inviteId} {
      allow read: if request.auth.token.email == resource.data.invitedEmail;
      allow create: if request.auth != null;
      allow update: if request.auth.token.email == resource.data.invitedEmail;
    }
  }
}
```

---

## Crawl Floor Builder

`floor-builder.html` is a standalone copy of the Crawl Floor Builder (floors, quests, Mob Forge, encounters, combat, sheets). It's one self-contained file: open it in a browser (or serve the folder as above).

- **Pre-made floors:** `+ New floor` → **📦 Pre-made floors** adds a ready-to-run floor with Quests, Mobs and Bosses: The Root Cellar (1), The Brass Bazaar (2), Neon Noodle District (3), The Iron Undertow (4).
- **Test mode:** open `floor-builder.html?test=1` (or **🧪 Test tools → Enter test mode**). "Fill with sample data" builds two test floors, *The Sandbox* (Floor 1) and *The Gauntlet* (Floor 3), plus three test crawlers.
- **Saving:** outside claude.ai there's no cloud save, so floors and sheets save to this browser's local storage. Use **Back up** / export to move data between devices. The live, cloud-synced version is the claude.ai artifact.

---

## File Structure

```
niner/
├── index.html          Login / Register
├── dashboard.html      Character & Campaign overview
├── character.html      Full 5e character sheet
├── campaign.html       Campaign tracker
├── floor-builder.html  Crawl Floor Builder (standalone, see below)
├── css/
│   ├── theme.css       Global DCC-themed styles
│   ├── dashboard.css
│   ├── character.css
│   └── campaign.css
└── js/
    ├── firebase-config.js   ← PUT YOUR CONFIG HERE
    ├── auth.js
    ├── characters.js
    ├── campaigns.js
    ├── sheet.js
    └── ui.js
```
