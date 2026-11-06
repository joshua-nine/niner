# [NINER]SHEET

A D&D 5e character sheet and campaign tracker with a **Dungeon Crawler Carl**-inspired neon HUD aesthetic.

> Built by a veteran getting into tech — welcome to the dungeon.

## Also in this repo: Agent Kingdom

A personal AI assistant team living in a pixel fantasy kingdom: you're the King, Queen Elara is your moral support and supervises every task, and the court of wizards, a treasury dragon and royals does the work. It syncs between your phone and computer. Nothing is sent, posted or spent without your royal seal. Run the local server below and open `/village/`. See [`village/README.md`](village/README.md).

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

## Firestore Security Rules (Required)

"Test mode" rules **expire after 30 days**. After that every read is refused and the dashboard can't load. Use the rules in [`firestore.rules`](firestore.rules) instead: in Firebase console → **Firestore Database → Rules**, replace everything with the contents of that file and click **Publish**. They cover NinerSheet (users, characters, campaigns, invites) and the Agent Kingdom (`kingdoms`).

```
rules_version = '2';

// Firestore security rules for NinerSheet + Agent Kingdom.
// Paste this whole file into Firebase console → Firestore Database → Rules,
// replacing everything there, then click Publish.
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function myEmail()  { return request.auth.token.email.lower(); }

    // Profiles: you write your own; signed-in players can read names
    // (the campaign page shows member names).
    match /users/{uid} {
      allow read:  if signedIn();
      allow write: if signedIn() && request.auth.uid == uid;
    }

    // Character sheets belong to their owner.
    match /characters/{charId} {
      allow read, update, delete: if signedIn() && resource.data.ownerId == request.auth.uid;
      allow create: if signedIn() && request.resource.data.ownerId == request.auth.uid;
    }

    // Campaigns: members can read and edit; only the owner can delete.
    match /campaigns/{campId} {
      allow read: if signedIn() && request.auth.uid in resource.data.members;
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid
        && request.auth.uid in request.resource.data.members;
      allow update: if signedIn() && (
        request.auth.uid in resource.data.members
        // accepting an invite: you may add yourself, and change nothing else
        || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members'])
            && request.resource.data.members.hasAll(resource.data.members)
            && request.resource.data.members.size() == resource.data.members.size() + 1
            && request.auth.uid in request.resource.data.members)
      );
      allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
    }

    // Invites: the person invited and the person who sent it can see it.
    match /invites/{inviteId} {
      allow read: if signedIn() && (
        resource.data.invitedEmail == myEmail()
        || resource.data.get('invitedBy', '') == request.auth.uid
      );
      allow create: if signedIn()
        && request.resource.data.invitedBy == request.auth.uid
        && request.resource.data.status == 'pending';
      allow update: if signedIn()
        && resource.data.invitedEmail == myEmail()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']);
    }

    // Agent Kingdom: one private document per person, synced across devices.
    match /kingdoms/{uid} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }
  }
}
```

---

## File Structure

```
niner/
├── index.html          Login / Register
├── dashboard.html      Character & Campaign overview
├── character.html      Full 5e character sheet
├── campaign.html       Campaign tracker
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
