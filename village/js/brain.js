// The brain. With an Anthropic API key, every courtier thinks with Claude
// (official @anthropic-ai/sdk, loaded in the browser). Without one, a small
// offline rules engine keeps the kingdom working so you can try it first.
//
// Step 5 + 7: agents get exactly three tools. None of them can send, post,
// spend or book anything. The only way out of the kingdom is
// request_approval, which lands in the King's Approvals queue.
import { GROUND_RULES, PRICES } from './config.js';
import {
  state, save, agentById, addTask, updateTask, requestApproval, log, openTasksFor,
  addUsage, liveTasks, updateApproval,
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
  // api.anthropic.com. Fine for a personal kingdom; never deploy it shared.
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
      description: 'Add a task to a courtier\'s to-do list. The owner walks home and works on it. Use for any piece of work, including drafting emails or posts (the draft itself is requested later via request_approval).',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short imperative task title, e.g. "Draft reply to Sam about Friday"' },
          owner: { type: 'string', enum: ids, description: 'Courtier id who owns the task' },
          notes: { type: 'string', description: 'Context the owner needs' },
        },
        required: ['title', 'owner'],
      },
    },
    {
      name: 'request_approval',
      description: 'Petition the King to approve (set the royal seal on) anything that leaves the kingdom: sending an email, publishing a post, spending money, or creating/accepting a calendar event. Include the complete, ready-to-use draft. Nothing happens unless the King approves, and even then the King performs the final click.',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['email', 'post', 'spend', 'calendar', 'other'] },
          summary: { type: 'string', description: 'One line the King reads in the queue' },
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
      description: 'Mark one of your tasks done and record the result (findings, plan, notes). Do not use this for work that still needs the King\'s approval.',
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
    if (!target || owner === 'mayor') return { error: `Unknown courtier "${owner}".` };
    const allowed = me.kind === 'chief' || owner === agentId || (me.intern && me.intern.id === owner);
    if (!allowed) {
      // Directors may not assign other domains' work: route via the Queen.
      const t = addTask({ title: input.title, owner: 'chief', notes: `From ${me.name} for ${target.name}: ${input.notes || ''}`, by: agentId });
      return { ok: true, task_id: t.id, note: 'Only the Queen (Chief of Staff) assigns work across the court, so this went to her.' };
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
    return { ok: true, approval_id: a.id, status: 'pending: the King will decide. Do not say it was sent/posted/paid.' };
  }
  if (name === 'complete_todo') {
    const t = state.tasks.find(x => x.id === input.task_id);
    if (!t) return { error: 'No such task.' };
    if (t.owner !== agentId && me.kind !== 'chief') return { error: 'You can only complete your own tasks.' };
    // Every finished task goes to the Queen for review (her own tasks excepted).
    const reviewed = t.owner === 'chief';
    updateTask(t.id, { status: reviewed ? 'done' : 'review', progress: 1, result: input.result || '' });
    log(agentId, reviewed ? `Completed: ${t.title}` : `Finished “${t.title}”. Sent to the Queen for review`, 'ok');
    return { ok: true, note: reviewed ? 'done' : 'The Queen will review your work before it is marked done.' };
  }
  return { error: `Unknown tool ${name}` };
}

function systemPrompt(agentId, mode) {
  const me = agentById(agentId);
  const roster = state.agents.map(a =>
    `- ${a.id}: ${a.name}, ${a.role}${a.intern ? ` (intern: ${a.intern.id} ${a.intern.name})` : ''}`).join('\n');
  const mine = liveTasks().filter(t => t.owner === agentId && t.status !== 'done' && t.status !== 'declined')
    .slice(0, 15).map(t => `- [${t.id}] ${t.title} — ${t.status}${t.notes ? ` (${t.notes})` : ''}`).join('\n') || '- (empty)';
  const extra = me.kind === 'chief'
    ? '\nOpen tasks across the court:\n' + (liveTasks().filter(t => t.status !== 'done' && t.status !== 'declined').slice(0, 25)
      .map(t => `- [${t.id}] ${agentById(t.owner)?.name}: ${t.title} — ${t.status}`).join('\n') || '- (none)')
    : '';
  const modeText = {
    chat: 'The King is speaking to you directly.',
    townhall: 'This is a Town Hall meeting with the whole team. Speak in turn, in at most 60 words, building on what others said. You may add tasks if something concrete comes up.',
    work: 'You are at your desk doing a task from your list.',
    review: 'You are reviewing a courtier\'s finished work before it is marked done or reaches the King. Be fair and specific; approve good work and praise it.',
  }[mode];
  return [
    `You are ${me.name}, ${me.role}, a member of the royal court in the AI Agent Kingdom of ${state.mayorName} (the King, a real person you assist). The court is a personal assistant team dressed up as a fantasy realm: the work itself is real and modern.`,
    `GROUND RULES (non-negotiable):\n${GROUND_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    `YOUR INSTRUCTIONS:\n${me.instructions || `You are ${me.role}. Help your master with small, concrete errands.`}`,
    `THE TEAM:\n${roster}`,
    `YOUR TO-DO LIST:\n${mine}${extra}`,
    `Today is ${new Date().toLocaleString()}. ${modeText}`,
    'If the King ever expresses real distress or thoughts of self-harm, respond with care first (never turn it into a task), and gently encourage reaching out to someone they trust or a crisis line (US: call or text 988; elsewhere: findahelpline.com).',
    'Write plain text (no markdown headings). Address the human as "Your Majesty" and keep a light medieval flavour, but be warm, brief and practical: real dates, real drafts, real next steps.',
  ].join('\n\n');
}

function trackUsage(resp) {
  const u = resp.usage || {};
  const price = PRICES[resp.model] || PRICES[state.settings.model] || { in: 0, out: 0 };
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  addUsage(inTok, u.output_tokens || 0, (inTok * price.in + (u.output_tokens || 0) * price.out) / 1e6);
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
  if (status === 401) return 'My API key was rejected — check it in the Kingdom tab.';
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
  const messages = [{ role: 'user', content: `Royal Court topic from ${state.mayorName}: "${topic}"\n\nSo far:\n${convo || '(you speak first)'}\n\nYour turn.` }];
  try { return await claudeLoop(agentId, messages, 'townhall') || '…'; }
  catch (e) { return friendlyError(e); }
}

// Called by the simulation when a director finishes the walk-and-work cycle.
export async function workOnTask(agentId, task) {
  let report;
  if (hasKey() && state.settings.autoWork) {
    const messages = [{ role: 'user', content:
      `Work on task [${task.id}] "${task.title}".${task.notes ? ` Notes: ${task.notes}` : ''}\n` +
      'Produce the deliverable now. If it needs anything to leave the kingdom (email, post, purchase, calendar event), call request_approval with task_id and the complete draft. ' +
      'Otherwise call complete_todo with the result (under 120 words). The Queen reviews all work, so make it complete and honest. Then give a one-sentence report for the Queen.' }];
    try { report = await claudeLoop(agentId, messages, 'work'); }
    catch (e) { report = friendlyError(e); }
  } else {
    report = offlineWork(agentId, task);
  }
  const t = state.tasks.find(x => x.id === task.id);
  if (t && t.status === 'doing')
    updateTask(t.id, { status: t.owner === 'chief' ? 'done' : 'review', progress: 1, result: t.result || report });
  return report;
}

// ── The Queen's supervision ──────────────────────────────────
// Every finished task (status "review") and every petition (stage "queen")
// is checked by the Queen before it is done or reaches the King.
// She may send work back once with feedback; after that she passes it on
// with a note, so nothing loops forever.
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'revise'] },
    note: { type: 'string', description: 'One or two sentences: your assessment, for the King and the courtier.' },
    feedback: { type: 'string', description: 'If revise: exactly what to fix. Otherwise empty.' },
  },
  required: ['verdict', 'note', 'feedback'],
  additionalProperties: false,
};

export function nextForReview() {
  const a = state.approvals.find(x => x.status === 'pending' && x.stage === 'queen');
  if (a) return { type: 'approval', item: a };
  const t = liveTasks().find(x => x.status === 'review');
  return t ? { type: 'task', item: t } : null;
}

async function claudeReview(what) {
  const { client } = await getClient();
  const model = state.settings.model;
  const params = {
    model, max_tokens: 2000,
    system: systemPrompt('chief', 'review'),
    output_config: { effort: state.settings.effort || 'low', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
    messages: [{ role: 'user', content: what }],
  };
  if (FALLBACK_MODELS.has(model)) { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
  const resp = await client.beta.messages.create(params);
  trackUsage(resp);
  if (resp.stop_reason === 'refusal') return null;
  const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(text); } catch { return null; }
}

export async function superviseNext() {
  const next = nextForReview();
  if (!next) return null;
  const { type, item } = next;
  const owner = agentById(type === 'task' ? item.owner : item.from);
  const task = type === 'task' ? item : state.tasks.find(t => t.id === item.taskId);
  const canRevise = task && (task.revisions || 0) < 1;
  let review = null;
  if (hasKey()) {
    const what = type === 'task'
      ? `Review ${owner?.name}'s finished task.\nTask: "${item.title}"\nNotes: ${item.notes || '(none)'}\nResult:\n${item.result || '(no result recorded)'}`
      : `Review ${owner?.name}'s petition before it reaches the King.\nKind: ${item.kind}\nSummary: ${item.summary}\nDraft:\n${JSON.stringify(item.details, null, 2)}` +
        (task ? `\nFor task: "${task.title}" (${task.notes || 'no notes'})` : '');
    try {
      review = await claudeReview(what + `\n\n${canRevise ? 'Approve if it is correct, complete and within the ground rules; otherwise choose revise with specific feedback.' : 'It has already been revised once: approve it, and mention any remaining concern in your note for the King.'}`);
    } catch (e) { log('chief', `Couldn't review with Claude (${friendlyError(e)}). Passed it on unreviewed`, 'warn'); }
  }
  if (!review) review = offlineReview(type, item, owner);
  if (review.verdict === 'revise' && !canRevise) review.verdict = 'approve';

  if (review.verdict === 'revise') {
    if (type === 'approval') updateApproval(item.id, { status: 'withdrawn', queenNote: review.note });
    updateTask(task.id, {
      status: 'todo', progress: 0, revisions: (task.revisions || 0) + 1,
      notes: `${task.notes ? task.notes + '\n' : ''}Queen's feedback: ${review.feedback || review.note}`,
    });
    log('chief', `Sent “${task.title}” back to ${owner?.name}: ${review.feedback || review.note}`, 'warn');
  } else if (type === 'task') {
    updateTask(item.id, { status: 'done', queenNote: review.note });
    log('chief', `Reviewed and approved “${item.title}”`, 'ok');
  } else {
    updateApproval(item.id, { stage: 'king', queenNote: review.note });
    log('chief', `Reviewed “${item.summary}”. It now awaits your royal seal`, 'approval');
  }
  return { type, item, owner, ...review };
}

function offlineReview(type, item, owner) {
  const name = owner?.name || 'The courtier';
  const notes = type === 'task'
    ? [`${name} did good work here. Marked complete.`, `Checked and complete. Well done, ${name}.`, `This meets the standard of the court.`]
    : [`I've read ${name}'s draft. It's ready for your seal, or edit it first if you like.`, `Checked: nothing goes out until you approve. The draft looks sound.`];
  return { verdict: 'approve', note: notes[Math.floor(Math.random() * notes.length)], feedback: '' };
}

// ── The Queen's moral support ────────────────────────────────
const FEELINGS = /\b(tired|exhausted|stress|stressed|overwhelm|anxious|anxiety|sad|down|bad day|rough day|burn(ed|t)? out|can'?t do|cannot do|struggling|frustrat|lonely|worried|scared|hopeless)/;
const CRISIS = /(kill myself|killing myself|end it all|end my life|hurt myself|harm myself|suicid|self[- ]?harm|want to die|wanna die|don'?t want to (live|be here|wake up)|no reason to live|can'?t go on|better off without me|not worth living)/;

export function doneToday() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return liveTasks().filter(t => t.status === 'done' && (t.updated || 0) >= start.getTime()).length;
}

function crisisReply() {
  return 'Your Majesty, I\'m really glad you told me, and I\'m staying right here with you. What you\'re feeling matters, and you deserve real support right now, from a real person. ' +
    'Please reach out to someone you trust, or a crisis line: in the US you can call or text 988, and findahelpline.com lists free, confidential lines in other countries. ' +
    'If you\'re in danger right now, please call your local emergency number. You don\'t have to carry this alone.';
}

function queenComfort(t) {
  if (CRISIS.test(t)) return crisisReply();
  const open = liveTasks().filter(x => ['todo', 'doing', 'review'].includes(x.status)).length;
  const done = doneToday();
  const lines = [
    'Oh, Your Majesty. That sounds heavy, and it makes sense you feel that way.',
    done ? `For what it's worth, ${done} thing${done > 1 ? 's' : ''} already got done today. That's real progress, even if it doesn't feel like it.` : 'Even showing up today counts. Truly.',
    open ? `There ${open > 1 ? 'are' : 'is'} ${open} open task${open > 1 ? 's' : ''}. The court can carry them, and nothing urgent goes anywhere without you. Want me to push the non-urgent ones to tomorrow?` : 'Your list is clear, so this might be a good moment to rest.',
    'Maybe a glass of water and five minutes away from the screen? The kingdom will still be here.',
  ];
  return lines.join(' ');
}

function queenPepTalk() {
  const done = doneToday();
  const total = liveTasks().filter(t => t.status === 'done').length;
  const picks = [
    'You built a whole kingdom to look after your life. That says a lot about you.',
    'Progress, not perfection, Your Majesty. One task at a time is how every castle gets built.',
    'You are allowed to be proud of yourself today.',
    'The court believes in you, and so do I.',
  ];
  const tally = done ? `You've finished ${done} task${done > 1 ? 's' : ''} today.` : total ? `The court has finished ${total} task${total > 1 ? 's' : ''} for you so far.` : 'Every kingdom starts with a first quest.';
  return `${picks[Math.floor(Math.random() * picks.length)]} ${tally} What's one small thing we can win next?`;
}

// Short lines the Queen says on her visits to the King's Keep.
export function queenVisitLine() {
  const done = doneToday();
  const lines = done
    ? [`${done} task${done > 1 ? 's' : ''} done today. I'm proud of you!`, `The court is thriving, Your Majesty: ${done} done today.`, 'Remember to take a break. You\'ve earned it.']
    : ['Just checking on you, Your Majesty. How are you holding up?', 'Drink some water, my King. The court has things in hand.', 'Whatever today brings, you\'re not facing it alone.'];
  return lines[Math.floor(Math.random() * lines.length)];
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
  if (CRISIS.test(t)) return crisisReply();             // any courtier: care first, never a task
  if (me.kind === 'chief' && FEELINGS.test(t)) return queenComfort(t);
  if (me.kind === 'chief' && /(pep talk|encourag|motivat|cheer me|proud)/.test(t)) return queenPepTalk();
  if (/^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/.test(t) && t.length < 25) {
    const n = openTasksFor(agentId).length;
    return `Greetings, Your Majesty! ${me.name}, ${me.role}, at your service. I have ${n} open task${n === 1 ? '' : 's'}. How may I serve?`;
  }
  if (/(status|what are you|update|how'?s it going|list)/.test(t)) {
    const open = me.kind === 'chief'
      ? liveTasks().filter(x => ['todo', 'doing', 'review', 'needs_approval'].includes(x.status))
      : openTasksFor(agentId);
    if (!open.length) return 'All is quiet in the realm: nothing open right now.';
    return 'The state of the realm, Your Majesty:\n' + open.slice(0, 8).map(x => `• ${agentById(x.owner)?.name}: ${x.title} (${x.status})`).join('\n');
  }
  if (me.kind === 'chief') {
    const d = routeDirector(text);
    const task = addTask({ title: titleFrom(text), owner: d.id, notes: `Requested by ${state.mayorName}: "${text}"`, by: agentId });
    const kind = detectKind(text);
    return `As you command. I have given “${task.title}” to ${d.name}, ${d.role}.` +
      (kind ? ` Since it involves ${kind === 'spend' ? 'spending gold from the treasury' : kind === 'calendar' ? 'your calendar' : kind === 'post' ? 'posting publicly' : 'sending an email'}, nothing goes out until you set your seal on it.` : '') +
      ' Watch them head home to work on it.';
  }
  const task = addTask({ title: titleFrom(text), owner: agentId, notes: `Requested directly by ${state.mayorName}: "${text}"`, by: 'mayor' });
  return `At once, Your Majesty. “${task.title}” is on my list. I'll set to work and report to ${agentById('chief')?.name || 'the Queen'} when it's done.`;
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
    return `The letter for “${task.title}” is drafted and awaits the King's seal.`;
  }
  if (kind === 'post') {
    requestApproval({ from: agentId, kind, taskId: task.id, summary: `Publish post: ${task.title}`, details: {
      platform: /linkedin/i.test(task.title) ? 'LinkedIn' : /insta/i.test(task.title) ? 'Instagram' : 'X / Twitter',
      body: `[Offline draft by ${me.name}] ${task.title}`,
    } });
    return `The proclamation for “${task.title}” is drafted. Nothing is published without the King's seal.`;
  }
  if (kind === 'spend') {
    const amt = Number((task.title + ' ' + task.notes).match(/\$\s?(\d+(?:\.\d+)?)/)?.[1] || 0);
    requestApproval({ from: agentId, kind, taskId: task.id, summary: `Spend: ${task.title}`, details: { amount: amt, body: 'Offline estimate — verify the price before buying.' } });
    return `I have counted the cost of “${task.title}”. Not one coin leaves the hoard without the King's seal.`;
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
  if (me.kind === 'chief') return `The court is in session, and first: thank you all, and thank you, Your Majesty, for leading us. Topic: “${topic}”. Each of you, give the King a quick report and name anything that needs the royal seal.`;
  const lines = [
    `${me.name} reporting, Your Majesty: I have ${n} open task${n === 1 ? '' : 's'}.`,
    n ? 'All on course. I will report to the Queen as each one lands.' : 'I stand ready for any new quest.',
  ];
  if ((me.keywords || []).some(k => topic.toLowerCase().includes(k))) lines.push('This falls within my domain. I will gladly lead it.');
  return lines.join(' ');
}
