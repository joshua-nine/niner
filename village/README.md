# Agent Kingdom

A personal AI assistant team that lives in a pixel fantasy kingdom. Claude is the brain. You are the **King**. **Queen Elara** is your moral support and the overseer of the court: every royal command goes to her, she hands the work out, and she reviews every finished task before it counts as done or reaches you. The court is two **wizards**, a **treasury dragon**, a **princess**, a **duchess** and a **prince**, each with a helper (an owl, an apprentice, a whelp, a jester, squires). They head home to their castles and towers to work, report to the Queen in person, gather before the **Great Hall** for Royal Court, and never send, post, spend, or book anything without your royal seal.

It's a static site with no build step and no server, and it works offline. Add an Anthropic API key and the court starts thinking with Claude. The fantasy is only the costume: the drafts, dates and plans are real.

## Run it
```bash
# from the repo root
python3 -m http.server 8080
# open http://localhost:8080/village/
```
The folder is still called `village/`, so existing links keep working. It also works on GitHub Pages or any other static host. (Opening the file directly doesn't work, because ES modules need a server.)

## The 7 steps, and where each one lives

| # | Step | In this build |
|---|---|---|
| 1 | **Build your world** | `RULES.md` (ground rules), `STYLE_GUIDE.md` (art direction), and `js/world.js` (castles, wizard towers, the Dragon's Hoard, mountain ranges, the courtyard, and a wild dragon circling the peaks) |
| 2 | **Move in with your Chief of Staff** | You're the King (crown, cape, scepter; rename yourself in the **Kingdom** tab) and live in the King's Keep. **Queen Elara** is your moral support and Chief of Staff: every request reaches her first, she routes it, and she checks in on you |
| 3 | **Bring in your directors** | The court: Iris, Court Wizard of Messages (Owl Post); Cal, Wizard of Time (Time Tower); Penny the Treasury Dragon (Dragon's Hoard); Princess Echo, Royal Herald; Duchess Sage of the Hearth; Prince Dex of Quests. Each has a helper, a home, instructions, and an `agents/<id>/` folder |
| 4 | **Make them move** | `js/path.js` runs A* that prefers roads; `js/agents.js` has the behaviour state machines plus tile reservation, so nobody (not even the dragon) walks through anyone else. The owl and the whelp fly |
| 5 | **Give them real jobs** | A to-do system, Gmail drafts, Google Calendar events, and post or spend requests (`js/brain.js` tools + **To-Do** tab) |
| 6 | **Talk to everyone** | Click anyone to chat (**Talk** tab). **Royal Court** gathers everyone before the Great Hall; the Queen opens, then each member of the court speaks in turn |
| 7 | **Stay in charge** | The court has no tool that can act outside the kingdom. The only way out is a petition (`request_approval`) into the **Approvals** tab, where you can edit the draft, set your royal seal, and perform the final click yourself |

## Queen Elara: moral support and supervisor
- **Moral support.** She celebrates your wins, notices when you sound tired or overwhelmed, and leads with kindness before task talk. Every few minutes she walks to the King's Keep just to check on you. When she's selected in **Talk** you get quick buttons: 💜 *Pep talk*, 😮‍💨 *Rough day*, 📋 *How's the court?*. If you ever say something that sounds like real distress, any member of the court responds with care and points you to real people (someone you trust, or a crisis line such as 988 in the US), and never turns it into a task.
- **Supervises every task.** Nothing is marked done, and no petition reaches you, until she has reviewed it. With Claude she checks the work is correct, complete, honest and within the rules. She can send it back **once** with specific feedback (the courtier redoes it); after that she passes it on with a note. Her note (👑) is shown on every task and petition. Without an API key she does a lighter check and approves.

## How work flows
1. You tell Queen Elara: *"Reply to Sam and say Friday works, and book a dentist appointment."*
2. The Queen calls `add_todo` twice: one task for Iris, one for Cal.
3. The two wizards walk to their towers (watch the map). A progress bar fills while they work and their tower windows light up.
4. When a task is done they draft the deliverable. Anything external becomes a petition (`request_approval`) carrying the full email or event.
5. They walk to the Queen's Tower to report, and the Queen reviews the work (🔍). Good work is approved with a note; weak work goes back once with feedback. The Queen then brings the reviewed petitions to the King's Keep.
6. In **Approvals** you edit, seal, or decline. Sealing an email opens a pre-filled Gmail draft, and **you** press Send.

## 💰 The Royal Treasury (household money tracker)
A **Treasury** tab tracks your household money, in collapsible sections:
- **Overview:** income per month, bills per month, left over, plus cash, debts and net (typical and average months).
- **Bills:** every recurring bill (monthly, annual, quarterly, as needed) with its due date, owner, account and balance owed. Each month shows what's paid, due soon or overdue; **Mark paid** ticks it off and records the payment in Spending. Annual and quarterly bills roll their next due date forward. Filter by person.
- **Spending:** this month's entries and budgets.
- **Income** and **Accounts & debts:** paychecks and balances, all editable.

To bring in an existing tracker, use **Import** with a tracker file (`kind: "agent-kingdom-treasury"` JSON; see `js/household.js`). Your figures then live only in your private, synced kingdom, never in this repo. Penny also understands *“paid the electric bill”*, *“what bills are due?”*, *“how much do I owe?”* and *“how's my cash flow?”*, and posts a daily reminder for bills due within 3 days.
- **Edit it yourself:** add, change (tap an entry) or delete entries, and set a monthly limit per category.
- **Penny keeps it live:** tell Penny or the Queen in Talk, for example *“spent $12 on lunch”*, *“paid $900 rent”*, *“got paid $2000”*, *“budget $300 for groceries”*, or *“how much have I spent?”*. Penny records it straight away, and with sync on it appears on all your devices within seconds. With an API key she uses `record_money` / `set_budget` tools.
- **Download / import:** pick **Everything, Bills, Spending, Income or Accounts**, then **⬇ Download**, which saves a CSV that opens in Excel or Google Sheets. **Import CSV** reads one back (or a bank export with Date / Description / Amount columns) and skips duplicates.
- **Bookkeeping only:** a request like *“buy dog food for $20”* stays a task, and the purchase comes to you as a petition. Nothing in the Treasury spends money.

## Use it on your phone and computer (nothing lost)
Sign in under **Kingdom → Your devices** with the same email and password on each device (your NinerSheet account works). Then:
- Tasks, petitions, chats, the court and your settings sync in real time through your Firebase account.
- Each device also keeps its own copy, so it still works offline and catches up when it reconnects.
- If you change things on both devices at once, the changes are **merged**, not overwritten.
- Only one device "runs the court" (does the background work and the Queen's reviews) at a time, so nothing happens twice. The device you're looking at takes over within a minute if the other goes to sleep.
- Your **API key is not synced**. Enter it once on each device.
- The top bar shows ☁️ *Synced* or 💾 *This device only*.
- On your phone, use *Add to Home Screen* to get a Kingdom app icon.

**One-time setup** (in the [Firebase console](https://console.firebase.google.com) for the project in `js/firebase-config.js`):
1. **Firestore rules:** the easiest way is to paste the whole [`firestore.rules`](../firestore.rules) file from the repo root into Firestore → Rules and click Publish (it covers NinerSheet too). Or add just this inside `match /databases/{database}/documents { … }`, so each person can only read and write their own kingdom:
   ```
   match /kingdoms/{uid} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   ```
2. **Put the site online** so your phone can reach it. The simplest way is GitHub Pages: in the repo, go to **Settings → Pages → Deploy from a branch**, pick the branch, and choose `/ (root)`. Your kingdom will be at `https://<your-username>.github.io/<repo>/village/`.
3. **Authentication → Settings → Authorized domains:** add that GitHub Pages domain (for example `your-username.github.io`).
4. **Authentication → Sign-in method:** make sure *Email/Password* is enabled (NinerSheet already uses it).

## Using Claude
In the **Kingdom** tab:
- **API key:** stored only in your browser's localStorage and sent only to `api.anthropic.com` via the official `@anthropic-ai/sdk` (loaded from jsDelivr). Use a personal key with a spend limit, and don't publish a page with a key baked in.
- **Model:** Claude Opus 5.5 by default; Sonnet, Haiku, and Fable are also available.
- **Effort:** Low keeps chat fast and cheap.
- **The court does real work:** when on, a finished task makes one more Claude call to produce the actual deliverable, plus one for the Queen's review.
- A **spend meter** in the top bar estimates API cost.
- **Server-side fallback** (`fallbacks: "default"`) is on for Opus, Sonnet, and Fable. If a safety classifier declines a turn, the API retries on a fallback model instead of failing it.

With no key, a small rules engine routes requests by keyword and makes placeholder drafts, so the whole loop still works.

## Using Claude Code as the brain
`CLAUDE.md` and `agents/*/CLAUDE.md` turn this folder into a Claude Code workspace:
```bash
cd village && claude                 # talk to Queen Elara, the Chief of Staff
cd village/agents/inbox && claude    # work as Iris, Court Wizard of Messages
```
With Gmail or Calendar connectors attached, agents stick to read-only access plus drafts. Approval requests go in `approvals/pending/` as markdown (see `RULES.md`).

## Make it yours (it should evolve weekly)
- Rename people, rewrite instructions, and change routing keywords in **Kingdom → The Court** (saved in the browser), or in `js/config.js` (the defaults).
- Change a courtier's costume with `look` in `js/config.js`: `queen`, `wizard`, `dragon`, `princess`, `prince`, `duchess`, `king`, `apprentice`, `squire`, `jester`, `owl`, or `whelp`.
- Add a member of the court by adding an entry to `DEFAULT_AGENTS` and a building to `BUILDINGS` (`castle`, `keep`, `tower`, `lair` or `manor`) in `js/config.js`, then running **Reset kingdom**.
- **Export JSON** backs up your kingdom; **Import JSON** restores it on another device.

## Files
```
village/
├── index.html, village.css, manifest.webmanifest, icon.svg
├── js/
│   ├── config.js   court roster, rules, map layout, mountains, palette, prices
│   ├── world.js    tile grid, castles/towers/mountains, rendering
│   ├── path.js     A* pathfinding
│   ├── sprites.js  royals, wizards, dragons, owl; labels, speech bubbles
│   ├── agents.js   movement, behaviours, Royal Court seating
│   ├── brain.js    Claude (SDK) + tools + offline engine
│   ├── store.js    tasks, approvals, chats, settings, device merge
│   ├── sync.js     phone ⇄ computer sync (Firebase), who runs the court
│   ├── treasury.js / household.js / treasury-ui.js   the Royal Treasury: spending, bills, income, accounts
│   ├── ui.js       side panel
│   └── main.js     boot + game loop
├── CLAUDE.md, RULES.md, STYLE_GUIDE.md
├── agents/<id>/CLAUDE.md, todo.md
└── approvals/pending/, approvals/done/
```
