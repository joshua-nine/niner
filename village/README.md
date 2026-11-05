# Agent Village

A personal AI assistant team that lives in a small pixel village. Claude is the brain. You are the **Mayor**: every request goes through your **Chief of Staff**, who hands work to six **Directors**, each with an **Intern**. They walk home to work, report back in person, gather at the **Town Hall**, and never send, post, spend, or book anything without your approval.

It's a static site with no build step and no server, and it works offline. Add an Anthropic API key and the villagers start thinking with Claude.

## Run it
```bash
# from the repo root
python3 -m http.server 8080
# open http://localhost:8080/village/
```
It also works on GitHub Pages or any other static host. (Opening the file directly doesn't work, because ES modules need a server.)

## The 7 steps, and where each one lives

| # | Step | In this build |
|---|---|---|
| 1 | **Build your world** | `RULES.md` (ground rules), `STYLE_GUIDE.md` (art direction), and `js/world.js` (map, roads, houses, pond, plaza, all drawn from the style palette) |
| 2 | **Move in with your Chief of Staff** | You're the Mayor (with the crown; rename yourself in the **Village** tab). **Matt** is the Chief of Staff, who receives every request and routes it |
| 3 | **Bring in your directors** | Iris (Inbox), Cal (Calendar), Penny (Money), Echo (Content), Sage (Health & Home), Dex (Projects), each with an intern, a house, instructions, and an `agents/<id>/` folder |
| 4 | **Make them move** | `js/path.js` runs A* that prefers roads; `js/agents.js` has the behaviour state machines plus tile reservation, so nobody walks through anyone else |
| 5 | **Give them real jobs** | A to-do system, Gmail drafts, Google Calendar events, and post or spend requests (`js/brain.js` tools + **To-Do** tab) |
| 6 | **Talk to everyone** | Click anyone to chat (**Talk** tab). **Town Hall** brings the team together; the Chief opens, then each director speaks in turn |
| 7 | **Stay in charge** | Agents have no tool that can act outside the village. The only way out is `request_approval` into the **Approvals** tab, where you can edit the draft and you perform the final click |

## How work flows
1. You tell Matt: *"Reply to Sam and say Friday works, and book a dentist appointment."*
2. Matt calls `add_todo` twice: one task for Iris, one for Cal.
3. Iris and Cal walk home (watch the map). A progress bar fills while they work and their windows light up.
4. When a task is done they draft the deliverable. Anything external becomes `request_approval`, carrying the full email or event.
5. They walk to Matt's office to report. Matt walks to your door with the approvals.
6. In **Approvals** you edit, approve, or decline. Approving an email opens a pre-filled Gmail draft, and **you** press Send.

## Using Claude
In the **Village** tab:
- **API key:** stored only in your browser's localStorage and sent only to `api.anthropic.com` via the official `@anthropic-ai/sdk` (loaded from jsDelivr). Use a personal key with a spend limit, and don't publish a page with a key baked in.
- **Model:** Claude Opus 5.5 by default; Sonnet, Haiku, and Fable are also available.
- **Effort:** Low keeps chat fast and cheap.
- **Agents do real work:** when on, a director's finished task makes one more Claude call to produce the actual deliverable.
- A **spend meter** in the top bar estimates API cost.
- **Server-side fallback** (`fallbacks: "default"`) is on for Opus, Sonnet, and Fable. If a safety classifier declines a turn, the API retries on a fallback model instead of failing it.

With no key, a small rules engine routes requests by keyword and makes placeholder drafts, so the whole loop still works.

## Using Claude Code as the brain
`CLAUDE.md` and `agents/*/CLAUDE.md` turn this folder into a Claude Code workspace:
```bash
cd village && claude                 # talk to Matt, the Chief of Staff
cd village/agents/inbox && claude    # work as Iris
```
With Gmail or Calendar connectors attached, agents stick to read-only access plus drafts. Approval requests go in `approvals/pending/` as markdown (see `RULES.md`).

## Make it yours (it should evolve weekly)
- Rename people, rewrite instructions, and change routing keywords in **Village → Team** (saved in the browser), or in `js/config.js` (the defaults).
- Add a director by adding an entry to `DEFAULT_AGENTS` and a building to `BUILDINGS` in `js/config.js`, then running **Reset village**.
- **Export JSON** backs up your village; **Import JSON** restores it on another device.

## Files
```
village/
├── index.html, village.css
├── js/
│   ├── config.js   roster, rules, map layout, palette, prices
│   ├── world.js    tile grid + static/dynamic rendering
│   ├── path.js     A* pathfinding
│   ├── sprites.js  pixel villagers, labels, speech bubbles
│   ├── agents.js   movement + behaviours + Town Hall seating
│   ├── brain.js    Claude (SDK) + tools + offline engine
│   ├── store.js    tasks, approvals, chats, settings (localStorage)
│   ├── ui.js       side panel
│   └── main.js     boot + game loop
├── CLAUDE.md, RULES.md, STYLE_GUIDE.md
├── agents/<id>/CLAUDE.md, todo.md
└── approvals/pending/, approvals/done/
```
