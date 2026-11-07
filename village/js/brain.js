// The brain. With an Anthropic API key, every courtier thinks with Claude
// (official @anthropic-ai/sdk, loaded in the browser). Without one, a small
// offline rules engine keeps the kingdom working so you can try it first.
//
// Step 5 + 7: agents get exactly three tools. None of them can send, post,
// spend or book anything. The only way out of the kingdom is
// request_approval, which lands in the King's Approvals queue.
import { GROUND_RULES, PRICES } from './config.js';
import {
  state, save, agentById, addTask, updateTask, requestApproval, log, openTasksFor, chatNote,
  addUsage, liveTasks, updateApproval,
} from './store.js';
import { addEntry, setBudget, parseMoney, parseBudget, treasuryBrief, setUpTreasury, money, treasury } from './treasury.js';
import { bills, matchBill, markPaid, isPaid, billsBrief, debtBrief, cashFlowBrief, upcomingBills, niceDate } from './household.js';

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
      name: 'record_money',
      description: 'Record money already spent or received in the Royal Treasury (the King\'s money tracker). Bookkeeping only: this never spends or moves money. Use a negative amount for spending and a positive amount for income.',
      input_schema: {
        type: 'object',
        properties: {
          desc: { type: 'string', description: 'What it was, e.g. "Lunch at Joe\'s"' },
          amount: { type: 'number', description: 'Negative = spent, positive = received' },
          category: { type: 'string', description: 'One of: Income, Housing, Bills & utilities, Groceries, Eating out, Transport, Health, Shopping, Subscriptions, Fun, Savings, Other' },
          date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' },
        },
        required: ['desc', 'amount'],
      },
    },
    {
      name: 'mark_bill_paid',
      description: 'Mark one of the King\'s recurring bills as paid for this month (records the payment in the Treasury). Bookkeeping only: it does not pay anything. Only use it when the King says the bill has been paid.',
      input_schema: {
        type: 'object',
        properties: { bill: { type: 'string', description: 'Bill name as listed, e.g. "Electric bill"' }, amount: { type: 'number', description: 'Amount paid, if different from the usual amount' } },
        required: ['bill'],
      },
    },
    {
      name: 'set_budget',
      description: 'Set the monthly budget for a Treasury category (0 removes it).',
      input_schema: {
        type: 'object',
        properties: { category: { type: 'string' }, amount: { type: 'number' } },
        required: ['category', 'amount'],
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
    const t = addTask({ title: input.title, owner, notes: input.notes || '', by: agentId, quiet: owner === agentId });
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
  if (name === 'record_money' || name === 'set_budget' || name === 'mark_bill_paid') {
    if (!['money', 'chief'].includes(agentId)) return { error: 'Only the Treasury Dragon (or the Queen) keeps the books. Ask Penny.' };
    try {
      if (name === 'set_budget') { setBudget(input.category, input.amount); return { ok: true, budgets: treasury().budgets }; }
      if (name === 'mark_bill_paid') {
        const b = bills().find(x => x.name.toLowerCase() === String(input.bill).toLowerCase()) || matchBill(input.bill);
        if (!b) return { error: `No bill matches "${input.bill}". Bills: ${bills().map(x => x.name).join(', ')}` };
        if (isPaid(b)) return { ok: true, note: `${b.name} was already marked paid this month.` };
        markPaid(b.id, { by: 'money', amount: input.amount });
        return { ok: true, marked: b.name };
      }
      const e = addEntry({ desc: input.desc, amount: input.amount, category: input.category, date: input.date, by: 'money' });
      return { ok: true, entry_id: e.id, summary: treasuryBrief() };
    } catch (err) { return { error: err.message }; }
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
  const books = ['money', 'chief'].includes(agentId)
    ? `\n\nTHE ROYAL TREASURY (the King's money tracker, in the 💰 Treasury tab): ${treasuryBrief()} Budgets: ${Object.entries(treasury().budgets).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${money(v)}`).join(', ') || 'none set yet'}. Use record_money when the King tells you about money already spent or received.${billsBrief(10) ? ' ' + billsBrief(10) : ''}${debtBrief() ? ' ' + debtBrief() : ''}${cashFlowBrief() ? ' ' + cashFlowBrief() : ''} Use mark_bill_paid when the King says a bill is paid.`
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
    `YOUR TO-DO LIST:\n${mine}${extra}${books}`,
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
    chatNote(owner?.id, `🔁 The Queen sent “${task.title}” back: ${review.feedback || review.note} I'm on it.`);
  } else if (type === 'task') {
    updateTask(item.id, { status: 'done', queenNote: review.note });
    log('chief', `Reviewed and approved “${item.title}”`, 'ok');
    chatNote(item.owner, `✅ Done: “${item.title}”.${item.result ? `\n\n${item.result}` : ''}\n\n👑 ${agentById('chief')?.name || 'The Queen'}: ${review.note}`);
  } else {
    updateApproval(item.id, { stage: 'king', queenNote: review.note });
    log('chief', `Reviewed “${item.summary}”. It now awaits your royal seal`, 'approval');
    chatNote(item.from, `📨 “${item.summary}” is drafted and waiting for your seal in Approvals.`);
  }
  return { type, item, owner, ...review };
}

function offlineReview(type, item, owner) {
  const name = owner?.name || 'The courtier';
  if (type === 'task' && /^Plan from /.test(item.result || ''))
    return { verdict: 'approve', note: `${name}'s plan is ready and sound. The next steps are yours, Your Majesty; just tell us when you'd like help with one.`, feedback: '' };
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
  const soon = upcomingBills(2);
  if (soon.length && Math.random() < 0.6) {
    const x = soon[0];
    return `A gentle reminder, my King: ${x.bill.name} (${money(x.bill.amount || 0)}) is ${x.overdue ? 'overdue since' : 'due'} ${niceDate(x.due)}.${soon.length > 1 ? ` ${soon.length - 1} more soon. Penny has the list.` : ''}`;
  }
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
export function routeDirector(text) {
  const t = text.toLowerCase();
  let best = null, score = 0;
  for (const a of state.agents.filter(a => a.kind === 'director')) {
    // keywords match at the start of a word: "rent" ≠ "parent", "financ" = "financial"
    const s = (a.keywords || []).reduce((n, k) => n + (new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t) ? 1 : 0), 0);
    if (s > score) { score = s; best = a; }
  }
  return best || state.agents.find(a => a.id === 'projects') || state.agents.find(a => a.kind === 'director');
}
// The Queen never does court work herself: anything that lands on her list
// she hands to the right courtier (or to whoever a note names: "… for Iris").
export function queenDelegate(task) {
  let target = null;
  const named = (task.notes || '').match(/\bfor ([A-Z][\w ]+?)(?::|$)/);
  if (named) target = state.agents.find(a => a.kind === 'director' && a.name.toLowerCase() === named[1].trim().toLowerCase());
  if (!target) target = routeDirector(`${task.title} ${task.notes || ''}`);
  if (!target) return null;
  const queen = agentById('chief')?.name || 'The Queen';
  updateTask(task.id, {
    owner: target.id, status: 'todo', progress: 0,
    notes: `${task.notes ? task.notes + '\n' : ''}Assigned by ${queen}.`,
  });
  log('chief', `Assigned “${task.title}” to ${target.name}, ${target.role}`, 'task');
  chatNote(target.id, `📜 New task from ${queen}: “${task.title}”.`);
  chatNote('chief', `I gave “${task.title}” to ${target.name}.`);
  return target;
}

const titleFrom = (text) => {
  const s = text.replace(/^(please |pls |kindly )?((can|could|would|will) you |please |pls |kindly )+/i, '').replace(/[?.!]+$/, '').trim();
  return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 90);
};

// What each member of the court can do, with example commands (free mode help).
const DOMAIN_HELP = {
  inbox: ['draft replies and emails (you seal them before anything is sent)', 'Reply to Sam and say Friday works'],
  calendar: ['plan your days and prepare calendar events', 'Schedule a dentist appointment next week'],
  money: ['track bills, budgets and purchases (no coin leaves the hoard without your seal)', 'Budget $200 for groceries this month'],
  content: ['draft posts and announcements', 'Write a LinkedIn post about my new project'],
  health: ['look after workouts, meals, groceries and chores', 'Plan three workouts for this week'],
  projects: ['break big goals and learning into steps', 'Help me learn JavaScript this month'],
};

function courtGuide() {
  const lines = state.agents.filter(a => a.kind === 'director').map(a => `• ${a.name} (${a.role.replace(/\s*\(.*\)$/, '')}): ${DOMAIN_HELP[a.id]?.[0] || a.role}`);
  return 'Here is how your court can serve you, Your Majesty:\n\n' +
    '• Tell me anything you need, in plain words, and I hand it to the right courtier. They walk home, do the work, and I review it before it counts as done.\n' +
    '• Anything that would leave the kingdom (an email, a post, a purchase, a calendar event) comes to you as a petition in Approvals. Nothing happens without your seal.\n' +
    '• I\'m also here for you: tap 💜 Pep talk or 😮‍💨 Rough day any time.\n\n' +
    lines.join('\n') +
    '\n\nTry: “Reply to Sam and say Friday works”, “Schedule a dentist appointment next week”, or “How\'s the court?”.';
}

function courtierHelp(me) {
  const h = DOMAIN_HELP[me.id];
  if (!h) return `I'm ${me.name}, ${me.role}. I help my master with small errands. Give me a task, or ask the Queen.`;
  return `I'm ${me.name}, ${me.role}. I can ${h[0]}. Just tell me what you need, for example: “${h[1]}”. When something needs to leave the kingdom, it comes to you to seal first.`;
}

// Requests (make a task) vs questions and chat (just answer).
const REQUEST_START = /^(please |pls |kindly )?(can|could|would|will) you\b|^(please|pls|kindly)\b|^(remind|schedule|book|email|reply|write|draft|send|post|buy|order|pay|plan|make|create|add|find|research|look up|check|call|text|message|prepare|set up|organi[sz]e|help me|i need|i want|we need|let'?s|get|clean|cancel|move|update|track|budget|learn|study)\b/;
const QUESTION_START = /^(what|who|why|how|when|where|which|is|are|am|do|does|did|was|were|have|has|should|shall|may)\b/;

function offlineChat(agentId, text) {
  const me = agentById(agentId);
  const t = text.toLowerCase().trim().replace(/[!.\s]+$/, '');
  const chief = me.kind === 'chief';
  const open = () => liveTasks().filter(x => ['todo', 'doing', 'review', 'needs_approval'].includes(x.status));

  if (CRISIS.test(t)) return crisisReply();             // any courtier: care first, never a task
  if (chief && FEELINGS.test(t)) return queenComfort(t);

  // Bills: "paid the electric bill", "what bills are due?", "how much do I owe?", "cash flow"
  if (bills().length) {
    if (/\b(paid|pay(ed)?|mark(ed)?)\b/.test(t) && !/\b(got paid|paid me|remind|can you pay|please pay|pay for)\b/.test(t)) {
      const b = matchBill(t);
      if (b) {
        if (isPaid(b)) return `${b.name} is already marked paid this month, Your Majesty.`;
        const amt = (t.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/) || [])[1];
        markPaid(b.id, { by: 'money', amount: amt ? Number(amt.replace(/,/g, '')) : undefined });
        return `${me.id === 'money' ? 'Done' : 'Penny marked it'}: ${b.name} is paid for this month (${money(amt ? Number(amt.replace(/,/g, '')) : b.amount || 0)}), and it's recorded in Spending. ${billsBrief(7)}`;
      }
    }
    if (/(what|which|any) (bills?|payments?)( are| is)? (due|coming|left|unpaid)|bills? (due|this week|coming up|left)|what('?s| is) due|upcoming bills|what do i (owe|pay) this week/.test(t))
      return billsBrief(/month/.test(t) ? 31 : 7) + ' The full list is in the 💰 Treasury tab, with a Mark paid button on each.';
    if (/how much (do|does) (i|we) owe|my debts?|total debt|credit card balances?|net worth|how much cash/.test(t))
      return (debtBrief() || 'No accounts recorded yet.') + ' See Accounts & debts in the 💰 Treasury tab.';
    if (/cash ?flow|left over|leftover|how much (is|do i have) left|can (i|we) afford/.test(t))
      return cashFlowBrief() + ' Details are in the 💰 Treasury tab.';
  }

  // The Treasury: "spent $12 on lunch", "got paid $2000", "budget $300 for groceries", "how much have I spent?"
  const budget = parseBudget(text);
  if (budget) { setBudget(budget.category, budget.amount); return `${chief ? 'Penny has' : 'I have'} set the ${budget.category} budget to ${money(budget.amount)} a month. You'll see it in the 💰 Treasury tab.`; }
  const rec = parseMoney(text);
  if (rec) {
    const e = addEntry({ ...rec, by: 'money' });
    return `${me.id === 'money' ? 'Recorded' : 'Penny recorded it'}: ${e.desc}, ${money(e.amount)} (${e.category}). ${treasuryBrief()} Open the 💰 Treasury tab to see or change it.`;
  }
  if (/how much (have i|did i|i('ve)?) (spent|spend|earned|made)|my (spending|budget|finances|money)|treasury|balance this month/.test(t))
    return `${treasuryBrief()} The full picture is in the 💰 Treasury tab, and you can download it as a spreadsheet there.`;
  if (chief && /(pep talk|encourag|motivat|cheer me|proud of me)/.test(t)) return queenPepTalk();

  // Small talk
  if (/^(hi|hey|hello|yo|sup|greetings|hail|good (morning|afternoon|evening|day))\b/.test(t) && t.length < 30) {
    const n = chief ? open().length : openTasksFor(agentId).length;
    return `Greetings, Your Majesty! ${chief ? me.name : `${me.name}, ${me.role},`} at your service. ${n ? `There ${n === 1 ? 'is' : 'are'} ${n} open task${n === 1 ? '' : 's'}.` : 'All is quiet right now.'} How may I serve?`;
  }
  if (/^(thanks|thank you|thx|ty|cheers|much appreciated|great job|well done|good job)\b/.test(t))
    return chief ? 'It is my joy to serve, Your Majesty. You\'re doing wonderfully.' : `My pleasure, Your Majesty. ${me.name} is always at your service.`;
  if (/how are you|how('?s| is) your day|how do you (do|feel)/.test(t))
    return chief ? 'I am well, Your Majesty, and the court is in good order. But more importantly: how are you today?' : `Splendid, Your Majesty! Ready for the next quest.`;
  if (/^(good ?night|bye|goodbye|see you|farewell)\b/.test(t))
    return chief ? 'Rest well, Your Majesty. The court will keep watch.' : 'Farewell, Your Majesty!';

  // Help and introductions
  if (/what can (you|u|the court|everyone) do|what do (you|u) do|^help\b|how (does|do) (this|it|the (app|kingdom|court)) work|how (do|can) i use|what (is|are) (this|the) (app|kingdom|court) for|what should i (say|ask|do)/.test(t))
    return chief ? courtGuide() : courtierHelp(me);
  if (/who are you|what('?s| is) your (name|role|job)|tell me about (yourself|you)/.test(t))
    return chief ? `I am ${me.name}: your Queen, your moral support, and the overseer of the court. Every request comes to me first, I send it to the right courtier, and I check their work before it reaches you. Ask me “what can you do?” for the full tour.` : courtierHelp(me);
  if (/who('?s| is)? (in|on) (the|my) (court|team)|who works for me|list (the )?(court|team)|who('?s| is) who/.test(t))
    return 'Your court, Your Majesty:\n' + state.agents.map(a => `• ${a.name}: ${a.role}${a.intern ? ` (helper: ${a.intern.name})` : ''}`).join('\n');

  // Status
  if (/status|how'?s (it going|the court|everything|work)|what('?s| is) (open|left|pending|on (my|the) list)|what are (you|they|we) (doing|working on)|update me|my (tasks|list)|^list\b/.test(t)) {
    const list = chief ? open() : openTasksFor(agentId);
    if (!list.length) return 'All is quiet in the realm: nothing open right now.';
    const label = { todo: 'to do', doing: 'in progress', review: 'with the Queen for review', needs_approval: 'awaiting your seal' };
    return 'The state of the realm, Your Majesty:\n' + list.slice(0, 8).map(x => `• ${agentById(x.owner)?.name}: ${x.title} (${label[x.status] || x.status})`).join('\n');
  }

  // A genuine question we can't answer well in free mode: answer honestly, don't make a task.
  const looksLikeQuestion = (t.endsWith('?') || QUESTION_START.test(t)) && !REQUEST_START.test(t);
  if (looksLikeQuestion)
    return `A fine question, Your Majesty, but in free mode I can only handle requests and reminders, not open questions. ` +
      `Give me something to do (for example “Remind me to call Mum on Sunday”), or ask your Claude app for a full answer. ` +
      `If you'd like it on someone's list anyway, start with “please”.`;

  // Otherwise it's a request: make a task.
  if (chief) {
    const d = routeDirector(text);
    const task = addTask({ title: titleFrom(text), owner: d.id, notes: `Requested by ${state.mayorName}: "${text}"`, by: agentId });
    const kind = detectKind(text);
    return `As you command. I have given “${task.title}” to ${d.name}, ${d.role}.` +
      (kind ? ` Since it involves ${kind === 'spend' ? 'spending gold from the treasury' : kind === 'calendar' ? 'your calendar' : kind === 'post' ? 'posting publicly' : 'sending an email'}, nothing goes out until you set your seal on it.` : '') +
      ' Watch them head home to work on it.';
  }
  const task = addTask({ title: titleFrom(text), owner: agentId, notes: `Requested directly by ${state.mayorName}: "${text}"`, by: 'mayor', quiet: true });
  return `At once, Your Majesty. “${task.title}” is on my list. I'll set to work and report to ${agentById('chief')?.name || 'the Queen'} when it's done.`;
}

function offlineWork(agentId, task) {
  const me = agentById(agentId);
  if (/\b(track(er|ing)?|ledger|budget|expenses?|spending|financ\w*|money)\b/i.test(task.title) && ['money', 'chief'].includes(agentId) && !/\b(buy|pay|purchase|order)\b/i.test(task.title)) {
    const msg = setUpTreasury(agentId);
    updateTask(task.id, { result: msg });
    return 'The Royal Treasury is open: see the 💰 Treasury tab.';
  }
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
  updateTask(task.id, { result: offlinePlan(agentId, task) });
  return `I've made a plan for “${task.title}”. It's on the task card.`;
}

// Free mode can't do open-ended work, but a courtier can hand back a real
// starter plan, and be honest that the next steps are the King's.
const PLANS = [
  [/\b(resume|résumé|cv|cover letter|job application|linkedin profile)\b/i, [
    'Pick one target job and copy its posting; highlight the skills and keywords it repeats.',
    'List your last 3 roles. For each, write 2–3 wins as "did X, which led to Y" (numbers where you can).',
    'Translate military or technical terms into plain civilian words the posting uses.',
    'Write a 2-line summary at the top that matches the target job.',
    'Keep it to 1–2 pages, save as PDF, and name it "First Last – Resume".',
  ]],
  [/\b(learn|study|course|class|homework|exam|certif\w*|practice)\b/i, [
    'Write down what "done" looks like (a certificate, a project, a grade).',
    'Split it into weekly chunks you can finish in 3–4 short sessions.',
    'Block those sessions on your calendar (ask Cal).',
    'After each session, write one line on what you learned and what\'s next.',
  ]],
  [/\b(workout|gym|exercise|run|fitness|lose weight|diet|meal plan|meals?)\b/i, [
    'Choose 3 days this week and a fixed time for each.',
    'Keep each session short: 10 min warm-up, 25 min main, 5 min stretch.',
    'Plan simple meals for the same days; make a grocery list from them.',
    'Tick each session off; aim for 3 in a row before adding more.',
  ]],
  [/\b(clean|declutter|organi[sz]e|chores?|laundry|garage|closet|yard)\b/i, [
    'Pick one area only; set a 25-minute timer.',
    'Three piles: keep, donate, toss. Bag the toss pile straight away.',
    'Wipe and put back what you keep; take the donate bag to the car.',
    'Book the next area for another day.',
  ]],
  [/\b(trip|travel|vacation|holiday|flight|hotel)\b/i, [
    'Set dates, budget and who\'s going.',
    'Compare 2–3 options for travel and stay; note total cost of each.',
    'Pick one and ask for a petition before anything is booked.',
    'Make a packing list a week before.',
  ]],
  [/\b(birthday|anniversary|gift|present|party|wedding|celebrat\w*)\b/i, [
    'Note the date and the budget.',
    'List 3 gift or plan ideas they\'d love; pick one.',
    'Order or book it at least a week ahead (comes to you as a petition).',
    'Add a reminder two days before for a card.',
  ]],
];
export function offlinePlan(agentId, task) {
  const me = agentById(agentId);
  const text = `${task.title} ${task.notes || ''}`;
  const steps = (PLANS.find(([re]) => re.test(text)) || [null, [
    'Decide what "done" looks like for this, in one sentence.',
    'Break it into 3 small steps you could each finish in under an hour.',
    'Put the first step on your calendar this week.',
    'Tell me when a step is done and I\'ll track the rest.',
  ]])[1];
  return `Plan from ${me?.name || 'the court'} for “${task.title}”:\n` + steps.map((s, i) => `${i + 1}. ${s}`).join('\n') +
    `\n\nIn free mode I can plan and track this, but the steps are yours. For a full draft (like a rewritten resume), paste this plan into your Claude app.`;
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
