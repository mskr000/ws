'use strict';
/* Pure business rules. No database, no I/O. Easy to test and to review. */

const CLASSES = ['controlled', 'periodic', 'record'];
const REASONS = ['Design change', 'Client comment', 'Vendor data', 'Error fix', 'Scope change', 'As-built'];
const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'xlsm', 'dwg', 'zip'];
const MAX_BYTES = 50 * 1024 * 1024;
const EXPIRY_WARN_DAYS = 30;

const STATUS = { SUBMITTED: 'Submitted', CHECKED: 'Checked', APPROVED: 'Approved', RETURNED: 'Returned' };

function isoDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function monthKey(d = new Date()) {
  return isoDay(d).slice(0, 7);
}
function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
/* Due date for a period: day `dueDay` of the month after the period. */
function dueDate(periodKey, dueDay) {
  return `${addMonths(periodKey, 1)}-${String(dueDay).padStart(2, '0')}`;
}
function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
}

/* Computed state of one monthly period. Never typed by a person. */
function periodState({ periodKey, dueDay, uploadedAt, na, today = isoDay() }) {
  if (na) return 'not_needed';
  const due = dueDate(periodKey, dueDay);
  if (uploadedAt) return uploadedAt.slice(0, 10) > due ? 'late' : 'on_time';
  if (periodKey > monthKey(new Date(today))) return 'upcoming';
  if (today <= due) return 'open';
  return 'missing';
}

/* Computed state of a certificate from its expiry date. */
function recordState(expiresOn, today = isoDay()) {
  const days = daysBetween(today, expiresOn);
  if (days < 0) return { state: 'expired', days };
  if (days <= EXPIRY_WARN_DAYS) return { state: 'expiring', days };
  return { state: 'valid', days };
}

function fileErrors(file) {
  const e = {};
  if (!file) return { file: 'Choose a file.' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) e.file = 'File type not allowed.';
  else if (file.size > MAX_BYTES) e.file = 'File is over 50 MB.';
  else if (file.size === 0) e.file = 'File is empty.';
  return e;
}

function summaryErrors(summary) {
  const s = (summary || '').trim();
  if (s.length < 20) return { summary: `Write at least 20 characters (${s.length} now).` };
  if (s.length > 280) return { summary: 'Summary is over 280 characters.' };
  return {};
}

/* Controlled documents: uploader, checker and approver must be three different people. */
function revisionErrors({ uploader, checker, approver, reason, summary, note, file }) {
  const e = Object.assign({}, fileErrors(file), summaryErrors(summary));
  if (!REASONS.includes(reason)) e.reason = 'Choose a reason.';
  if ((note || '').trim().length < 10) e.note = 'Write at least 10 characters for the checker.';
  if (!checker) e.checker = 'Choose a checker.';
  if (!approver) e.approver = 'Choose an approver.';
  if (checker && checker === uploader) e.checker = 'The checker cannot be the uploader.';
  if (approver && approver === uploader) e.approver = 'The approver cannot be the uploader.';
  if (checker && approver && checker === approver) e.approver = 'Approver must differ from the checker.';
  return e;
}

function canCheck(rev, actor) {
  if (rev.status !== STATUS.SUBMITTED) return 'This revision is not waiting for a check.';
  if (actor === rev.by) return 'You added this revision, so you cannot check it.';
  if (actor !== rev.checker) return `Only ${rev.checker} can check this revision.`;
  return null;
}
function canApprove(rev, actor) {
  if (rev.status !== STATUS.CHECKED) return 'This revision is not waiting for approval.';
  if (actor === rev.by || actor === rev.checker) return 'The approver must differ from the uploader and the checker.';
  if (actor !== rev.approver) return `Only ${rev.approver} can approve this revision.`;
  return null;
}
function canReturn(rev, actor) {
  if (![STATUS.SUBMITTED, STATUS.CHECKED].includes(rev.status)) return 'This revision is not waiting.';
  if (![rev.checker, rev.approver].includes(actor)) return 'Only the checker or approver can send a revision back.';
  return null;
}

/* Recurring: uploads are allowed for the series owner or the records lead. */
function canUploadPeriod(doc, actor, actorRole) {
  if (actorRole === 'admin' || actor === doc.owner) return null;
  return `Only ${doc.owner} or the records lead can upload to this series.`;
}
function periodErrors({ file, summary, replaceReason, existing }) {
  const e = Object.assign({}, fileErrors(file), summaryErrors(summary));
  if (existing && (replaceReason || '').trim().length < 10) e.replaceReason = 'Say why you are replacing it (10+ characters).';
  return e;
}
function naErrors(reason) {
  if ((reason || '').trim().length < 10) return { naReason: 'Give a reason of at least 10 characters.' };
  return {};
}

/* Certificates: expiry must be a future date. */
function renewalErrors({ file, summary, expiresOn, today = isoDay() }) {
  const e = Object.assign({}, fileErrors(file), summaryErrors(summary));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn || '') || (expiresOn || '') <= today) {
    e.expiresOn = 'Enter an expiry date after today.';
  }
  return e;
}

/* Removal and restore are admin-only. Removal needs a reason. */
function canRemove(actorRole) {
  return actorRole === 'admin' ? null : 'Only the records lead can remove a document.';
}
function removeErrors({ reason, text }) {
  const e = {};
  if (!reason) e.reason = 'Choose a reason.';
  if ((text || '').trim().length < 20) e.text = 'Write at least 20 characters to say why.';
  return e;
}

/* ---------- Numbering pattern ----------
   Tokens: {PROJ} project code, {TYPE} document type code, {SEQ:n} sequence padded to n digits (required, once),
           {YYYY} year. Other characters allowed: letters, digits, - . _ /
   Example: {PROJ}-{TYPE}-{SEQ:4} gives U100-PID-0001. */
const DEFAULT_PATTERN = '{PROJ}-{TYPE}-{SEQ:4}';
const PATTERN_TOKEN_RE = /\{(PROJ|TYPE|YYYY|SEQ(?::(\d))?)\}/g;

function patternErrors(pattern) {
  const p = String(pattern || '');
  if (!p) return 'Enter a numbering pattern.';
  if (p.length > 40) return 'Pattern is too long (40 characters at most).';
  const rest = p.replace(PATTERN_TOKEN_RE, '');
  if (/[{}]/.test(rest)) return 'Unknown token. Use {PROJ}, {TYPE}, {SEQ:4} or {YYYY}.';
  if (!/^[A-Za-z0-9\-._/]*$/.test(rest)) return 'Only letters, digits and - . _ / are allowed between tokens.';
  const seqs = [...p.matchAll(PATTERN_TOKEN_RE)].filter(m => m[1].startsWith('SEQ'));
  if (seqs.length !== 1) return 'The pattern needs exactly one {SEQ} token.';
  const w = seqs[0][2] ? Number(seqs[0][2]) : 4;
  if (w < 1 || w > 6) return 'Sequence width must be between 1 and 6 digits.';
  return null;
}

const escRe = t => t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
function patternWidth(pattern) {
  const m = [...pattern.matchAll(PATTERN_TOKEN_RE)].find(x => x[1].startsWith('SEQ'));
  return m && m[2] ? Number(m[2]) : 4;
}
/* Fill a pattern for one project, type and sequence number. */
function formatNumber(pattern, { project, type, seq, year }) {
  return pattern.replace(PATTERN_TOKEN_RE, (_, tok, w) => {
    if (tok === 'PROJ') return project;
    if (tok === 'TYPE') return type;
    if (tok === 'YYYY') return String(year);
    return String(seq).padStart(Number(w || 4), '0');
  });
}
/* A regular expression that matches numbers made from this pattern for one project and type. Captures the sequence. */
function numberRegex(pattern, { project, type }) {
  let out = '^';
  let last = 0;
  for (const m of pattern.matchAll(PATTERN_TOKEN_RE)) {
    out += escRe(pattern.slice(last, m.index));
    const tok = m[1];
    if (tok === 'PROJ') out += escRe(project);
    else if (tok === 'TYPE') out += escRe(type);
    else if (tok === 'YYYY') out += '\\d{4}';
    else out += `(\\d{${patternWidth(pattern)},})`;
    last = m.index + m[0].length;
  }
  out += escRe(pattern.slice(last)) + '$';
  return new RegExp(out);
}
/* Next number. Continues from the highest sequence used for this project and type, or from the first number. */
function nextNumber({ pattern = DEFAULT_PATTERN, project, type, existingNumbers, firstNumber = 1, year = new Date().getUTCFullYear() }) {
  const re = numberRegex(pattern, { project, type });
  let max = 0;
  for (const n of existingNumbers) {
    const m = re.exec(n);
    if (m) {
      const v = Number(m[1]);
      if (Number.isInteger(v) && v > max) max = v;
    }
  }
  const seq = Math.max(max + 1, Number(firstNumber) || 1);
  return formatNumber(pattern, { project, type, seq, year });
}
/* Example for the page, using the first number and a sample project and type. */
function patternExample(pattern, firstNumber = 1) {
  if (patternErrors(pattern)) return null;
  return formatNumber(pattern, { project: 'U100', type: 'PID', seq: firstNumber, year: new Date().getUTCFullYear() });
}

/* ---------- Project setup ---------- */
const CODE_RE = /^[A-Z0-9]{2,5}$/;
const FOLDER_SEG_RE = /^[A-Za-z0-9][A-Za-z0-9 .&()\-]{0,59}$/;

/* A folder path is 1 to 4 segments separated by "/". Each segment is a plain name. */
function folderPathErrors(path) {
  const segs = String(path || '').split('/');
  if (segs.length < 1 || segs.length > 4) return 'Folder path can have 1 to 4 levels.';
  for (const s of segs) {
    if (!FOLDER_SEG_RE.test(s.trim()) || s !== s.trim()) return `"${s}" is not a valid folder name.`;
  }
  return null;
}

/* Full check of a project setup before anything is written. Returns { field: message }. */
function projectSetupErrors({ code, name, folders, types, firstNumbers = {}, isNew, existingCodes = [] }) {
  const e = {};
  if (isNew) {
    if (!CODE_RE.test(code || '')) e.code = 'Project code: 2 to 5 capital letters or digits, for example U100.';
    else if (existingCodes.includes(code)) e.code = `${code} already exists.`;
  }
  if (!(name || '').trim()) e.name = 'Give the project a name.';
  if (!Array.isArray(folders) || folders.length === 0) e.folders = 'Add at least one folder.';
  else {
    const seen = new Set();
    folders.forEach(f => {
      const err = folderPathErrors(f);
      if (err) e[`folder:${f}`] = err;
      if (seen.has(f)) e[`folder:${f}`] = 'This folder is listed twice.';
      seen.add(f);
    });
  }
  const enabled = (types || []).filter(t => t.enabled);
  if (enabled.length === 0) e.types = 'Turn on at least one document type.';
  for (const t of enabled) {
    if (!folders || !folders.includes(t.folder)) e[`type:${t.code}`] = `${t.code} must file into one of the project folders.`;
    const n = Number(t.firstNumber || 1);
    if (!Number.isInteger(n) || n < 1 || n > 9999) e[`first:${t.code}`] = 'First number must be between 1 and 9999.';
  }
  return e;
}

module.exports = {
  DEFAULT_PATTERN, patternErrors, formatNumber, numberRegex, patternExample,
  projectSetupErrors, folderPathErrors, CODE_RE,
  CLASSES, REASONS, ALLOWED_EXT, MAX_BYTES, EXPIRY_WARN_DAYS, STATUS,
  isoDay, monthKey, addMonths, dueDate, daysBetween,
  periodState, recordState,
  fileErrors, summaryErrors, revisionErrors,
  canCheck, canApprove, canReturn,
  canUploadPeriod, periodErrors, naErrors,
  renewalErrors, canRemove, removeErrors,
  nextNumber,
};
