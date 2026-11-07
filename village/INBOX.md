# Working with the kingdom from Claude (the Inbox hand-off)

The kingdom app runs in **free mode** (no API key). Real thinking happens in Claude, in the Claude app or a Claude Code session on the King's own subscription. The two meet in the King's tracker spreadsheet (the one the Sheets bridge is installed in):

| Tab | Who writes it | What it holds |
|---|---|---|
| **Kingdom – Tasks** | the app (rewritten on every sync) | the court's open tasks and those finished in the last 14 days: Task ID, Courtier, Title, Status, Notes, Result |
| **Kingdom – Bills / Spending / Accounts / Income** | the app | the Treasury, for reference |
| **Kingdom – Inbox** | **Claude appends rows**; the app marks them | work for the kingdom to pick up |

The app checks the Inbox when it opens, every 10 minutes, and when the King taps **📥 Check inbox** (Treasury → Google Sheet). For each row it applies, it sets **Status** to `done in app` (or `error`) and explains in **App note**.

## Reading the court's to-do list
Read **Kingdom – Tasks**. Use the **Task ID** (e.g. `T3b5hye`) when you hand back a result.

## Adding a row to Kingdom – Inbox
Append one row per item, with these columns:

| ID | Created | From | To | Type | Title | Details | Status | App note | Updated |
|---|---|---|---|---|---|---|---|---|---|
| unique, e.g. `c-20261107-01` | `2026-11-07 09:30` | `Claude` | courtier (or blank) | see below | see below | see below | `new` | *(leave blank)* | *(leave blank)* |

Leave **Status** as `new` and the last two columns empty. Never edit rows that are already `done in app`, or any other tab, unless the King asks.

| Type | To | Title | Details |
|---|---|---|---|
| `task` | courtier name (Iris, Cal, Penny, Echo, Sage, Dex) or blank for the Queen to assign | what to do | notes / context |
| `result` | blank | the **Task ID** (or exact task title) | the finished work: plan, draft, research, answer. The Queen reviews it, then it shows as done in the courtier's chat |
| `note` | courtier | optional heading | a message for that courtier's chat (e.g. a summary for the King) |
| `petition` | courtier who drafted it (optional) | one-line summary the King reads | `kind: email` (or `post`, `spend`, `calendar`), then lines like `to:`, `subject:`, `amount:`, `when: 2026-11-20T10:00`, `duration: 30`, `task: T3b5hye`, then a **blank line**, then the body |
| `bill` | blank | bill name exactly as in the Treasury | lines like `amount: 412.50`, `due: 2026-12-14`, `balance: 4800`, `notes: …`, `link: https://drive.google.com/…` |

Example rows:

```
c-20261107-01 | 2026-11-07 09:30 | Claude | Dex   | task     | Draft a 4-week JavaScript study plan | The King wants evenings only, 3 nights a week | new
c-20261107-02 | 2026-11-07 09:41 | Claude |       | result   | T3b5hye | (the rewritten resume text) | new
c-20261107-03 | 2026-11-07 09:45 | Claude | Iris  | petition | Reply to Sam: Friday works | kind: email
                                                               to: sam@example.com
                                                               subject: Friday

                                                               Hi Sam, Friday works for me… | new
c-20261107-04 | 2026-11-07 09:50 | Claude |       | bill     | Pepco (Electric) | amount: 412.50
                                                               due: 2026-12-14
                                                               link: https://drive.google.com/file/d/… | new
```

## Rules (same as everywhere in the kingdom; see RULES.md)
- Nothing leaves the kingdom without the King's seal. Emails, posts, purchases and calendar invites go in as **petitions**. Do not send or book anything yourself. Gmail *drafts* are fine.
- Be honest in results: say what you did and didn't do.
- Keep the King's personal data inside his own sheet and Drive. Never put it in the code repository.
