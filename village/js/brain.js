// The brain. With an Anthropic API key, every villager thinks with Claude
// (official @anthropic-ai/sdk, loaded in the browser). Without one, a small
// offline rules engine keeps the village working so you can try it first.
//
// Step 5 + 7: agents get exactly three tools. None of them can send, post,
// spend or book anything — the only way out of the village is
// request_approval, which lands in the Mayor's Approvals queue.
import { GROUND_RULES, PRICES } from './config.js';
import {
  state, save, agentById, addTask, updateTask, requestApproval, log, openTasksFor,
} from './store.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.1.0/+esm';
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1']);
let clientCache = { key: null, client: null, Anthropic: null };

export const hasKey = () => !!state.settings.apiKey;

async function getClient() {
  const key = state.settings.apiKey;
  if (clientCache.client && clientCache.key === key) return clientCache;
  const mod = await import(SDK_URL);
  const Anthropic = mod.default ?? mod.Anthropic;
  // The key lives only in this browser (localStorage) and goes straight to
  // api.anthropic.com. Fine for a personal village; never deploy it shared.
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  clientCache = { key, client, Anthropic };
  return clientCache;
}

// ── Tool definitions ─────────────────────────────────────────
function tools() {
  const ids = [];
  for (const a of state.agents) { ids.push(a.id); if (a.intern) ids.push(a.intern.id); }
  return [
    {
      name: 'add_todo',
      description: 'Add a task to a villager\'s to-do list. The owner walks home and works on it. Use for any piece of work, including drafting emails or posts (the draft itself is requested later via request_approval).',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short imperative task title, e.g. "Draft reply to Sam about Friday"' },
          owner: { type: 'string', enum: ids, description: 'Villager id who owns the task' },
          notes: { type: 'string', description: 'Context the owner needs' },
        },
        required: ['title', 'owner'],
      },
    },
    {
      name: 'request_approval',
      description: 'Ask the Mayor to approve anything that leaves the village: sending an email, publishing a post, spending money, or creating/accepting a calendar event. Include the complete, ready-to-use draft. Nothing happens unless the Mayor approves, and even then the Mayor performs the final click.',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['email', 'post', 'spend', 'calendar', 'other'] },
          summary: { type: 'string', description: 'One line the Mayor reads in the queue' },
          task_id: { type: 'string', description: 'Related task id, if any' },
          to: { type: 'string', description: 'email: recipient address(es)' },
          subject: { type: 'string', description: 'email subject / calendar event title' },
          body: { type: 'string', description: 'email body, post text, or event description' },
          platform: { type: 'string', description: 'post: where it would be published' },
          amount: { type: 'number', description: 'spend: amount in dollars' },
          when: { type: 'string', description: 'calendar: ISO 8601 local start time, e.g. 2026-11-06T10:00' },
          duration_minutes: { type: 'number', description: 'calendar: length in minutes' },
        },
        required: ['kind', 'summary'],
      },
    },
    {
      name: 'complete_todo',
      description: 'Mark one of your tasks done and record the result (findings, plan, notes). Do not use this for work that still needs Mayor approval.',
      input_schema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          result: { type: 'string', description: 'What you produced, in a few lines' },
        },
        required: ['task_id', 'result'],
      },
    },
  ];
}

// Permissions are enforced here, not just in the prompt.
function runTool(agentId, name, input) {
  const me = agentById(agentId);
  if (name === 'add_todo') {
    let owner = input.owner;
    const target = agentById(owner);
    if (!target || owner === 'mayor') return { error: `Unknown villager "${owner}".` };
    const allowed = me.kind === 'chief' || owner === agentId || (me.intern && me.intern.id === owner);
    if (!allowed) {
      // Directors may not assign other departments' work — route via the Chief.
      const t = addTask({ title: input.title, owner: 'chief', notes: `From ${me.name} for ${target.name}: ${input.notes || ''}`, by: agentId });
      return { ok: true, task_id: t.id, note: 'Only the Chief of Staff assigns work across departments, so this went to the Chief.' };
    }
    const t = addTask({ title: input.title, owner, notes: input.notes || '', by: agentId });
    return { ok: true, task_id: t.id, owner: target.name };
  }
  if (name === 'request_approval') {
    const kinds = ['email', 'post', 'spend', 'calendar', 'other'];
    if (!kinds.includes(input.kind) || !input.summary) return { error: 'kind and summary are required.' };
    const { kind, summary, task_id, ...details } = input;
    const task = state.tasks.find(t => t.id === task_id);
    const a = requestApproval({ from: agentId, kind, summary, details, taskId: task ? task.id : null });
    return { ok: true, approval_id: a.id, status: 'pending — the Mayor will decide. Do not say it was sent/posted/paid.' };
  }
  if (name === 'complete_todo') {
    const t = state.tasks.find(x => x.id === input.task_id);
    if (!t) return { error: 'No such task.' };
    if (t.owner !== agentId && me.kind !== 'chief') return { error: 'You can only complete your own tasks.' };
    updateTask(t.id, { status: 'done', progress: 1, result: input.result || '' });
    log(agentId, `Completed: ${t.title}`, 'ok');
    return { ok: true };
  }
  return { error: `Unknown tool ${name}` };
}

function systemPrompt(agentId, mode) {
  const me = agentById(agentId);
  const roster = state.agents.map(a =>
    `- ${a.id}: ${a.name}, ${a.role}${a.intern ? ` (intern: ${a.intern.id} ${a.intern.name})` : ''}`).join('\n');
  const mine = state.tasks.filter(t => t.owner === agentId && t.status !== 'done' && t.status !== 'declined')
    .slice(0, 15).map(t => `- [${t.id}] ${t.title} — ${t.status}${t.notes ? ` (${t.notes})` : ''}`).join('\n') || '- (empty)';
  const extra = me.kind === 'chief'
    ? '\nVillage-wide open tasks:\n' + (state.tasks.filter(t => t.status !== 'done' && t.status !== 'declined').slice(0, 25)
      .map(t => `- [${t.id}] ${agentById(t.owner)?.name}: ${t.title} — ${t.status}`).join('\n') || '- (none)')
    : '';
  const modeText = {
    chat: 'The Mayor is talking to you directly.',
    townhall: 'This is a Town Hall meeting with the whole team. Speak in turn, in at most 60 words, building on what others said. You may add tasks if something concrete comes up.',
    work: 'You are at your desk doing a task from your list.',
  }[mode];
  return [
    `You are ${me.name}, ${me.role}, a villager in ${state.mayorName}'s AI Agent Village — a personal assistant team.`,
    `GROUND RULES (non-negotiable):\n${GROUND_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    `YOUR INSTRUCTIONS:\n${me.instructions || `You are ${me.role}. Help your director with small, concrete errands.`}`,
    `THE TEAM:\n${roster}`,
    `YOUR TO-DO LIST:\n${mine}${extra}`,
    `Today is ${new Date().toLocaleString()}. ${modeText}`,
    'Write plain text (no markdown headings). Be warm but brief.',
  ].join('\n\n');
}

function trackUsage(resp) {
  const u = resp.usage || {};
  const price = PRICES[resp.model] || PRICES[state.settings.model] || { in: 0, out: 0 };
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  state.usage.input += inTok;
  state.usage.output += u.output_tokens || 0;
  state.usage.cost += (inTok * price.in + (u.output_tokens || 0) * price.out) / 1e6;
  state.usage.calls += 1;
  save();
}

async function claudeLoop(agentId, messages, mode) {
  const { client } = await getClient();
  const model = state.settings.model;
  const params = {
    model,
    max_tokens: 4000,
    system: systemPrompt(agentId, mode),
    tools: tools(),
    output_config: { effort: state.settings.effort || 'low' },
    messages,
  };
  // Server-side fallback: if a safety classifier declines, the API retries
  // on a suitable fallback model instead of failing the turn.
  if (FALLBACK_MODELS.has(model)) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }

  let text = '';
  for (let turn = 0; turn < 6; turn++) {
    const resp = await client.beta.messages.create(params);
    trackUsage(resp);
    if (resp.stop_reason === 'refusal') return text || '(I can\'t help with that one.)';
    const said = resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (said) text = said;
    params.messages.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason === 'pause_turn') continue;
    if (resp.stop_reason !== 'tool_use') break;
    const results = resp.content.filter(b => b.type === 'tool_use').map(b => {
      let out;
      try { out = runTool(agentId, b.name, b.input || {}); } catch (e) { out = { error: e.message }; }
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out), is_error: !!out.error };
    });
    params.messages.push({ role: 'user', content: results });
  }
  return text;
}

function friendlyError(e) {
  const status = e?.status;
  if (status === 401) return 'My API key was rejected — check it in the Village tab.';
  if (status === 429) return 'We\'re being rate-limited. Give me a moment and try again.';
  if (status === 400) return `The API rejected the request: ${e.message}`;
  if (String(e?.message || '').includes('Failed to fetch') || String(e?.message || '').includes('import'))
    return 'I couldn\'t reach Claude (network or blocked CDN). Falling back to offline mode for this message.';
  return `Something went wrong: ${e?.message || e}`;
}

// ── Public API ───────────────────────────────────────────────
export async function chat(agentId, userText) {
  const hist = (state.chats[agentId] ||= []);
  hist.push({ role: 'user', text: userText, ts: Date.now() });
  save();
  let reply;
  if (hasKey()) {
    try {
      const messages = hist.slice(-12).map(m => ({ role: m.role, content: m.text }));
      while (messages.length && messages[0].role !== 'user') messages.shift();
      reply = await claudeLoop(agentId, messages, 'chat') || 'Noted.';
    } catch (e) {
      reply = friendlyError(e);
      if (reply.includes('offline')) reply += '\n\n' + offlineChat(agentId, userText);
    }
  } else {
    reply = offlineChat(agentId, userText);
  }
  hist.push({ role: 'assistant', text: reply, ts: Date.now() });
  save();
  return reply;
}

export async function townhallTurn(agentId, topic, transcript) {
  if (!hasKey()) return offlineTownhall(agentId, topic);
  const convo = transcript.map(m => `${agentById(m.from)?.name || m.from}: ${m.text}`).join('\n');
  const messages = [{ role: 'user', content: `Town Hall topic from ${state.mayorName}: "${topic}"\n\nSo far:\n${convo || '(you speak first)'}\n\nYour turn.` }];
  try { return await claudeLoop(agentId, messages, 'townhall') || '…'; }
  catch (e) { return friendlyError(e); }
}

// Called by the simulation when a director finishes the walk-and-work cycle.
export async function workOnTask(agentId, task) {
  let report;
  if (hasKey() && state.settings.autoWork) {
    const messages = [{ role: 'user', content:
      `Work on task [${task.id}] "${task.title}".${task.notes ? ` Notes: ${task.notes}` : ''}\n` +
      'Produce the deliverable now. If it needs anything to leave the village (email, post, purchase, calendar event), call request_approval with task_id and the complete draft. ' +
      'Otherwise call complete_todo with the result (under 120 words). Then give a one-sentence report for the Chief of Staff.' }];
    try { report = await claudeLoop(agentId, messages, 'work'); }
    catch (e) { report = friendlyError(e); }
  } else {
    report = offlineWork(agentId, task);
  }
  const t = state.tasks.find(x => x.id === task.id);
  if (t && t.status === 'doing') updateTask(t.id, { status: 'done', progress: 1, result: t.result || report });
  return report;
}

// ── Offline rules engine ─────────────────────────────────────
const KIND_WORDS = {
  email: ['email', 'reply', 'write to', 'respond', 'message'],
  post: ['post', 'tweet', 'publish', 'caption', 'linkedin', 'instagram'],
  spend: ['buy', 'purchase', 'pay', 'order', 'subscribe', '$'],
  calendar: ['meeting', 'schedule', 'book', 'appointment', 'calendar', 'call with'],
};
function detectKind(text) {
  const t = text.toLowerCase();
  for (const [k, words] of Object.entries(KIND_WORDS)) if (words.some(w => t.includes(w))) return k;
  return null;
}
function routeDirector(text) {
  const t = text.toLowerCase();
  let best = null, score = 0;
  for (const a of state.agents.filter(a => a.kind === 'director')) {
    const s = (a.keywords || []).reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
    if (s > score) { score = s; best = a; }
  }
  return best || state.agents.find(a => a.id === 'projects') || state.agents.find(a => a.kind === 'director');
}
const titleFrom = (text) => {
  const s = text.replace(/^(please|can you|could you|pls)\s+/i, '').replace(/[?.!]+$/, '').trim();
  return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 90);
};

function offlineChat(agentId, text) {
  const me = agentById(agentId);
  const t = text.toLowerCase().trim();
  if (/^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/.test(t) && t.length < 25) {
    const n = openTasksFor(agentId).length;
    return `Hey ${state.mayorName}! ${me.role} here. I have ${n} open task${n === 1 ? '' : 's'}. What do you need?`;
  }
  if (/(status|what are you|update|how'?s it going|list)/.test(t)) {
    const open = me.kind === 'chief'
      ? state.tasks.filter(x => x.status === 'todo' || x.status === 'doing')
      : openTasksFor(agentId);
    if (!open.length) return 'All clear — nothing open right now.';
    return 'Here\'s where things stand:\n' + open.slice(0, 8).map(x => `• ${agentById(x.owner)?.name}: ${x.title} (${x.status})`).join('\n');
  }
  if (me.kind === 'chief') {
    const d = routeDirector(text);
    const task = addTask({ title: titleFrom(text), owner: d.id, notes: `Requested by ${state.mayorName}: "${text}"`, by: agentId });
    const kind = detectKind(text);
    return `On it. I've handed “${task.title}” to ${d.name} (${d.role}).` +
      (kind ? ` Since it involves ${kind === 'spend' ? 'spending money' : kind === 'calendar' ? 'your calendar' : kind === 'post' ? 'posting publicly' : 'sending an email'}, nothing goes out until you approve it.` : '') +
      ' You\'ll see them walk home to work on it.';
  }
  const task = addTask({ title: titleFrom(text), owner: agentId, notes: `Requested directly by ${state.mayorName}: "${text}"`, by: 'mayor' });
  return `Got it — “${task.title}” is on my list. I'll head to my desk now and report back to ${agentById('chief')?.name || 'the Chief'} when it's done.`;
}

function offlineWork(agentId, task) {
  const me = agentById(agentId);
  const kind = detectKind(task.title + ' ' + task.notes);
  if (kind === 'email') {
    const to = (task.notes.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0];
    requestApproval({ from: agentId, kind, taskId: task.id, summary: `Send email: ${task.title}`, details: {
      to, subject: task.title.replace(/^(email|reply to|write to)\s*/i, '').slice(0, 70) || 'Quick note',
      body: `Hi,\n\n[Draft prepared offline by ${me.name} for: "${task.title}". Add an API key for real drafts.]\n\nBest,\n${state.mayorName}`,
    } });
    return `Drafted the email for “${task.title}” — it's waiting for the Mayor's approval.`;
  }
  if (kind === 'post') {
    requestApproval({ from: agentId, kind, taskId: task.id, summary: `Publish post: ${task.title}`, details: {
      platform: /linkedin/i.test(task.title) ? 'LinkedIn' : /insta/i.test(task.title) ? 'Instagram' : 'X / Twitter',
      body: `[Offline draft by ${me.name}] ${task.title}`,
    } });
    return `Draft post ready for “${task.title}” — needs approval before anything is published.`;
  }
  if (kind === 'spend') {
    const amt = Number((task.title + ' ' + task.notes).match(/\$\s?(\d+(?:\.\d+)?)/)?.[1] || 0);
    requestApproval({ from: agentId, kind, taskId: task.id, summary: `Spend: ${task.title}`, details: { amount: amt, body: 'Offline estimate — verify the price before buying.' } });
    return `Priced out “${task.title}” — waiting on your OK before any money moves.`;
  }
  if (kind === 'calendar') {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    requestApproval({ from: agentId, kind, taskId: task.id, summary: `Add to calendar: ${task.title}`, details: {
      subject: task.title, when: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`, duration_minutes: 30,
      body: `Proposed by ${me.name}. Adjust the time as needed.`,
    } });
    return `Found a slot for “${task.title}” (tomorrow 10:00) — needs your approval.`;
  }
  updateTask(task.id, { result: `Offline mode: broke “${task.title}” into next steps and filed notes. Add an API key for real work.` });
  return `Done with “${task.title}”. Notes are on the task card.`;
}

function offlineTownhall(agentId, topic) {
  const me = agentById(agentId);
  const n = openTasksFor(agentId).length;
  if (me.kind === 'chief') return `Thanks for calling us in. Topic: “${topic}”. Each director, give a quick update and flag anything that needs ${state.mayorName}'s approval.`;
  const lines = [
    `From ${me.role.replace('Director of ', '')}: I have ${n} open task${n === 1 ? '' : 's'}.`,
    n ? 'On track — I\'ll report to the Chief as each one lands.' : 'I have capacity if anything comes up.',
  ];
  if ((me.keywords || []).some(k => topic.toLowerCase().includes(k))) lines.push('This one is squarely in my area — happy to take point.');
  return lines.join(' ');
}
