# Agent Village: Claude Code brain

This folder is the Mayor's AI Agent Village. Claude Code is the brain; the browser village (`index.html`) is the map where the team lives.

## Read first
1. `RULES.md`: the ground rules. Non-negotiable.
2. `agents/chief/CLAUDE.md`: if no agent is named, you are the **Chief of Staff**.

## Layout
```
agents/<id>/CLAUDE.md   who the agent is, its tools, its intern
agents/<id>/todo.md     its to-do list   ([ ] open · [~] doing · [?] waiting on approval · [x] done)
agents/chief/reports.md one line per finished task
approvals/pending/      requests waiting for the Mayor
approvals/done/         decided requests (kept for the record)
js/config.js            the same roster and rules used by the browser village
```

## Running an agent
- `cd agents/inbox && claude` runs a session *as* Iris, using her CLAUDE.md.
- From this folder, "Matt, here's my week: …" means the Chief of Staff splits the request into each director's `todo.md`.
- Directors may use subagents as their interns for small errands.

## Connected tools (MCP)
If Gmail or Google Calendar connectors are attached, use them **read-only, plus drafts**:
- Gmail: `search_threads`, `get_thread`, labels, `create_draft`. Never `send_message`, `reply`, or `forward`.
- Calendar: `list_events`, `search_events`, `suggest_time`. Never create, update, delete, or respond to events.
Anything that would leave the village becomes an approval file (see `RULES.md`).

## Evolving the village
The Mayor edits these files weekly: rename agents, add a director, sharpen instructions. Keep `js/config.js` in sync so the map matches.
