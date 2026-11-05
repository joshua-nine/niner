# Agent Kingdom

A personal AI assistant team that lives in a pixel fantasy kingdom. Claude is the brain. You are the **King**: every royal command goes to **Queen Elara**, your Chief of Staff, who hands work to the court. The court is two **wizards**, a **treasury dragon**, a **princess**, a **duchess** and a **prince**, each with a helper (an owl, an apprentice, a whelp, a jester, squires). They head home to their castles and towers to work, report to the Queen in person, gather before the **Great Hall** for Royal Court, and never send, post, spend, or book anything without your royal seal.

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
| 2 | **Move in with your Chief of Staff** | You're the King (crown, cape, scepter; rename yourself in the **Kingdom** tab) and live in the King's Keep. **Queen Elara** is the Chief of Staff: every request reaches her first and she routes it |
| 3 | **Bring in your directors** | The court: Iris, Court Wizard of Messages (Owl Post); Cal, Wizard of Time (Time Tower); Penny the Treasury Dragon (Dragon's Hoard); Princess Echo, Royal Herald; Duchess Sage of the Hearth; Prince Dex of Quests. Each has a helper, a home, instructions, and an `agents/<id>/` folder |
| 4 | **Make them move** | `js/path.js` runs A* that prefers roads; `js/agents.js` has the behaviour state machines plus tile reservation, so nobody (not even the dragon) walks through anyone else. The owl and the whelp fly |
| 5 | **Give them real jobs** | A to-do system, Gmail drafts, Google Calendar events, and post or spend requests (`js/brain.js` tools + **To-Do** tab) |
| 6 | **Talk to everyone** | Click anyone to chat (**Talk** tab). **Royal Court** gathers everyone before the Great Hall; the Queen opens, then each member of the court speaks in turn |
| 7 | **Stay in charge** | The court has no tool that can act outside the kingdom. The only way out is a petition (`request_approval`) into the **Approvals** tab, where you can edit the draft, set your royal seal, and perform the final click yourself |

## How work flows
1. You tell Queen Elara: *"Reply to Sam and say Friday works, and book a dentist appointment."*
2. The Queen calls `add_todo` twice: one task for Iris, one for Cal.
3. The two wizards walk to their towers (watch the map). A progress bar fills while they work and their tower windows light up.
4. When a task is done they draft the deliverable. Anything external becomes a petition (`request_approval`) carrying the full email or event.
5. They walk to the Queen's Tower to report. The Queen walks to the King's Keep with the petitions.
6. In **Approvals** you edit, seal, or decline. Sealing an email opens a pre-filled Gmail draft, and **you** press Send.

## Using Claude
In the **Kingdom** tab:
- **API key:** stored only in your browser's localStorage and sent only to `api.anthropic.com` via the official `@anthropic-ai/sdk` (loaded from jsDelivr). Use a personal key with a spend limit, and don't publish a page with a key baked in.
- **Model:** Claude Opus 5.5 by default; Sonnet, Haiku, and Fable are also available.
- **Effort:** Low keeps chat fast and cheap.
- **The court does real work:** when on, a finished task makes one more Claude call to produce the actual deliverable.
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
├── index.html, village.css
├── js/
│   ├── config.js   court roster, rules, map layout, mountains, palette, prices
│   ├── world.js    tile grid, castles/towers/mountains, rendering
│   ├── path.js     A* pathfinding
│   ├── sprites.js  royals, wizards, dragons, owl; labels, speech bubbles
│   ├── agents.js   movement, behaviours, Royal Court seating
│   ├── brain.js    Claude (SDK) + tools + offline engine
│   ├── store.js    tasks, approvals, chats, settings (localStorage)
│   ├── ui.js       side panel
│   └── main.js     boot + game loop
├── CLAUDE.md, RULES.md, STYLE_GUIDE.md
├── agents/<id>/CLAUDE.md, todo.md
└── approvals/pending/, approvals/done/
```
