/**
 * Agent Kingdom ⇄ Google Sheets bridge
 * ────────────────────────────────────
 * Paste this into your tracker spreadsheet: Extensions → Apps Script.
 * Then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone),
 * and paste the web app URL + the key below into the kingdom (Treasury → Google Sheet).
 *
 * What it does, and nothing more:
 *  • Writes four tabs it owns: "Kingdom – Bills", "Kingdom – Spending",
 *    "Kingdom – Accounts", "Kingdom – Income" (rewritten on every sync).
 *  • In your "Recurring Bills" tab it ONLY touches "Paid <Month Year>" columns:
 *    it adds one per month to the right of your headers and ticks ✓ the bills
 *    the kingdom has marked paid. Your formulas, subtotals and other cells
 *    are never written.
 *  • "Pull from sheet": reads your Recurring Bills, Accounts & Balances and
 *    Income & Cash Flow tabs and sends them to the kingdom (read-only).
 *
 * Requests must carry the secret KEY, so only your kingdom can use it.
 */

// ⬇ Paste the key shown in the kingdom (Treasury → Google Sheet) between the quotes.
var KEY = 'PASTE-YOUR-KINGDOM-KEY-HERE';

// Tab names in your spreadsheet (change these if you rename tabs).
var BILLS_TAB = 'Recurring Bills';
var ACCOUNTS_TAB = 'Accounts & Balances';
var INCOME_TAB = 'Income & Cash Flow';

var TAB_BILLS = 'Kingdom – Bills';
var TAB_SPENDING = 'Kingdom – Spending';
var TAB_ACCOUNTS = 'Kingdom – Accounts';
var TAB_INCOME = 'Kingdom – Income';

// ── Entry points ──────────────────────────────────────────────
function doPost(e) {
  return respond_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkKey_(body.key);
    if (body.action === 'sync') return sync_(body);
    if (body.action === 'ping') return { ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
    throw new Error('Unknown action');
  });
}

function doGet(e) {
  return respond_(function () {
    var p = (e && e.parameter) || {};
    checkKey_(p.key);
    if (p.action === 'pull') return pull_();
    if (p.action === 'ping') return { ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
    throw new Error('Unknown action');
  });
}

function respond_(fn) {
  var out;
  try { out = fn(); } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(k) {
  if (!KEY || KEY.indexOf('PASTE-') === 0) throw new Error('The bridge key has not been set in the script yet.');
  if (k !== KEY) throw new Error('Wrong key.');
}

// ── Sync: kingdom → sheet ────────────────────────────────────
function sync_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var t = body.treasury || {};
    var bills = (t.bills || []).filter(function (b) { return !b.deleted; });
    var months = monthsToShow_(bills, body.month);

    writeTab_(ss, TAB_BILLS, ['Group', 'Bill', 'Amount', 'Frequency', 'Next Due', 'Owner', 'Paid With', 'Balance Owed', 'Notes'].concat(months.map(label_)),
      bills.map(function (b) {
        return [b.group || '', b.name, num_(b.amount), b.frequency || '', b.nextDue || '', b.owner || '', b.paidWith || '', b.balance == null ? '' : num_(b.balance), b.notes || '']
          .concat(months.map(function (m) { return b.paidMonths && b.paidMonths[m] ? '✓' : ''; }));
      }));

    writeTab_(ss, TAB_SPENDING, ['Date', 'Description', 'Category', 'Amount', 'Type', 'Added by', 'Note'],
      (t.entries || []).filter(function (x) { return !x.deleted; })
        .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; })
        .map(function (x) { return [x.date, x.desc, x.category, num_(x.amount), x.amount > 0 ? 'Income' : 'Expense', x.byName || x.by || '', x.note || '']; }));

    writeTab_(ss, TAB_ACCOUNTS, ['Account', 'Institution', 'Last 4', 'Owner', 'Type', 'Balance', 'As Of', 'Notes'],
      (t.accounts || []).filter(function (x) { return !x.deleted; })
        .map(function (a) { return [a.name, a.institution || '', a.last4 ? "'" + a.last4 : '', a.owner || '', a.type || '', num_(a.balance), a.asOf || '', a.notes || '']; }));

    writeTab_(ss, TAB_INCOME, ['Income', 'Owner', 'Deposits To', 'Amount', 'Frequency', 'Notes'],
      (t.incomes || []).filter(function (x) { return !x.deleted; })
        .map(function (i) { return [i.name, i.owner || '', i.depositsTo || '', num_(i.amount), i.frequency || '', i.notes || '']; }));

    var ticked = body.tickPaid === false ? null : tickPaid_(ss, bills, months);
    return { ok: true, bills: bills.length, entries: (t.entries || []).length, ticked: ticked };
  } finally {
    lock.releaseLock();
  }
}

// The current month, plus any month in the last year with a payment.
function monthsToShow_(bills, current) {
  var set = {};
  set[current] = true;
  bills.forEach(function (b) { Object.keys(b.paidMonths || {}).forEach(function (m) { set[m] = true; }); });
  var floor = shiftMonth_(current, -11);
  return Object.keys(set).filter(function (m) { return /^\d{4}-\d{2}$/.test(m) && m >= floor && m <= current; }).sort();
}

function writeTab_(ss, name, header, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var data = [header].concat(rows);
  sh.getRange(1, 1, data.length, header.length).setValues(data.map(function (r) {
    var row = r.slice(0, header.length); while (row.length < header.length) row.push(''); return row;
  }));
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sh.setFrozenRows(1);
}

// Tick "Paid <Month Year>" columns in the Recurring Bills tab.
// Only cells in those columns are written; nothing else is touched.
function tickPaid_(ss, bills, months) {
  var sh = ss.getSheetByName(BILLS_TAB);
  if (!sh) return { error: 'No "' + BILLS_TAB + '" tab' };
  var values = sh.getDataRange().getValues();
  var headerRows = [];
  for (var r = 0; r < values.length; r++) if (norm_(values[r][0]) === 'bill') headerRows.push(r);
  if (!headerRows.length) return { error: 'No header row starting with "Bill"' };

  // Where are the "Paid …" columns? Add missing ones after the last used header column.
  var width = values[0] ? values[0].length : 0;
  var lastUsed = 0;
  headerRows.forEach(function (hr) { for (var c = 0; c < width; c++) if (String(values[hr][c]).trim() !== '') lastUsed = Math.max(lastUsed, c); });
  var colFor = {};
  months.forEach(function (m) {
    var label = label_(m), found = -1;
    headerRows.forEach(function (hr) { for (var c = 0; c < width; c++) if (String(values[hr][c]).trim() === label) found = c; });
    if (found < 0) { lastUsed += 1; found = lastUsed; headerRows.forEach(function (hr) { sh.getRange(hr + 1, found + 1).setValue(label).setFontWeight('bold'); }); }
    colFor[m] = found;
  });

  // Match kingdom bills to rows by name.
  var byName = {};
  bills.forEach(function (b) { byName[norm_(b.name)] = b; });
  var matched = 0, cells = 0, firstHeader = headerRows[0];
  for (var row = firstHeader + 1; row < values.length; row++) {
    if (headerRows.indexOf(row) >= 0) continue;
    var b = byName[norm_(values[row][0])];
    if (!b) continue;
    matched++;
    months.forEach(function (m) {
      var want = b.paidMonths && b.paidMonths[m] ? '✓' : '';
      var col = colFor[m];
      var have = col < width ? String(values[row][col] == null ? '' : values[row][col]) : '';
      if (have !== want) { sh.getRange(row + 1, col + 1).setValue(want); cells++; }
    });
  }
  return { matched: matched, of: bills.length, cellsChanged: cells, columns: months.map(label_) };
}

// ── Pull: sheet → kingdom (read-only) ────────────────────────
function pull_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var out = { ok: true, kind: 'agent-kingdom-treasury', version: 1, source: ss.getName() + ' (pulled)', people: [], bills: [], incomes: [], accounts: [] };
  var people = {};

  var bs = ss.getSheetByName(BILLS_TAB);
  if (bs) {
    var v = bs.getDataRange().getValues(), group = '', inSection = false;
    for (var r = 0; r < v.length; r++) {
      var a = String(v[r][0] == null ? '' : v[r][0]).trim(), rest = v[r].slice(1).join('').trim();
      if (!a) continue;
      if (/^summary$/i.test(a) || /^split by owner/i.test(a)) break;
      if (norm_(a) === 'bill') { inSection = true; continue; }
      if (rest && /subtotal|\btotal\b/i.test(a)) continue;   // subtotal / total rows (headings like "AS NEEDED (not in totals)" have no values)
      if (!rest) {                                   // a heading row
        if (/annual|quarterly/i.test(a)) group = 'Annual & quarterly';
        else if (/as needed/i.test(a)) group = 'As needed';
        else if (!/^monthly bills$/i.test(a) && a !== a.toUpperCase()) group = a;
        continue;
      }
      if (!inSection) continue;
      var amount = money_(v[r][1]), freq = String(v[r][2] || '').trim() || 'Monthly';
      if (/^[-—–]?$/.test(String(v[r][1]).trim()) && !amount && !String(v[r][5] || '').trim()) continue;   // placeholder rows like "Costco  -" (no owner yet)
      var owner = String(v[r][5] || '').trim();
      if (owner) people[owner] = true;
      out.bills.push({
        importKey: 'bill:' + a, group: group, name: a, amount: amount,
        frequency: /annual/i.test(freq) ? 'Annual' : /quarter/i.test(freq) ? 'Quarterly' : /as needed/i.test(freq) ? 'As needed' : /bi-?weekly/i.test(freq) ? 'Biweekly' : /weekly/i.test(freq) ? 'Weekly' : 'Monthly',
        nextDue: date_(v[r][3], tz), owner: owner, paidWith: String(v[r][6] || '').trim(),
        balance: String(v[r][7]).trim() === '' ? null : money_(v[r][7]), notes: String(v[r][8] || '').trim(),
      });
    }
  }

  var as = ss.getSheetByName(ACCOUNTS_TAB);
  if (as) {
    var av = as.getDataRange().getValues(), started = false;
    for (var i = 0; i < av.length; i++) {
      var name = String(av[i][0] == null ? '' : av[i][0]).trim();
      if (norm_(name) === 'account') { started = true; continue; }
      if (!started || !name || !String(av[i][4] || '').trim()) continue;
      out.accounts.push({ importKey: 'acct:' + name, name: name, institution: String(av[i][1] || '').trim(), last4: String(av[i][2] || '').trim(),
        owner: String(av[i][3] || '').trim(), type: String(av[i][4] || '').trim(), balance: money_(av[i][5]), asOf: date_(av[i][6], tz), notes: String(av[i][7] || '').trim() });
    }
  }

  var is = ss.getSheetByName(INCOME_TAB);
  if (is) {
    var iv = is.getDataRange().getValues(), go = false;
    for (var j = 0; j < iv.length; j++) {
      var n = String(iv[j][0] == null ? '' : iv[j][0]).trim();
      if (norm_(n) === 'income' && norm_(iv[j][1]) === 'owner') { go = true; continue; }
      if (!go) continue;
      if (!n || /total/i.test(n)) { if (/total/i.test(n)) break; continue; }
      var f = String(iv[j][4] || '').trim();
      out.incomes.push({ importKey: 'income:' + n, name: n, owner: String(iv[j][1] || '').trim(), depositsTo: String(iv[j][2] || '').trim(),
        amount: money_(iv[j][3]), frequency: /bi-?weekly/i.test(f) ? 'Biweekly' : /weekly/i.test(f) ? 'Weekly' : /annual|year/i.test(f) ? 'Annual' : 'Monthly', notes: '' });
    }
  }
  out.people = Object.keys(people);
  return out;
}

// ── Helpers ───────────────────────────────────────────────────
function norm_(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function num_(n) { var x = Number(n); return isFinite(x) ? Math.round(x * 100) / 100 : ''; }
function money_(v) {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  var s = String(v == null ? '' : v).trim();
  if (!s || /^[-—–]$/.test(s)) return 0;
  var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  var x = Number(s.replace(/[^0-9.]/g, ''));
  return isFinite(x) ? (neg ? -x : x) : 0;
}
function date_(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  if (!s || /^[-—–]$/.test(s)) return '';
  var d = new Date(s);
  return isNaN(d) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}
function shiftMonth_(m, n) {
  var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) - 1 + n;
  y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
  return y + '-' + (mo < 9 ? '0' : '') + (mo + 1);
}
function label_(m) {
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return 'Paid ' + names[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
}
