/* Business rules for the Document Register. Pure functions: no SharePoint, no browser.
   Ported from app/src/rules.js. Changing a rule here means changing its test too. */

export type DocKind = 'controlled' | 'periodic' | 'record';
export type RevStatus = 'Submitted' | 'Checked' | 'Approved' | 'Returned';

export const KINDS: DocKind[] = ['controlled', 'periodic', 'record'];
export const REASONS = ['Design change', 'Client comment', 'Vendor data', 'Error fix', 'Scope change', 'As-built'];
export const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'xlsm', 'dwg', 'zip'];
export const MAX_BYTES = 50 * 1024 * 1024;
export const EXPIRY_WARN_DAYS = 30;
export const DEFAULT_PATTERN = '{PROJ}-{TYPE}-{SEQ:4}';

export type Errors = Record<string, string>;

export interface FileInfo { name: string; size: number }

export const isoDay = (d: Date = new Date()): string => d.toISOString().slice(0, 10);
export const monthKey = (d: Date = new Date()): string => isoDay(d).slice(0, 7);

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
/* Due date for a monthly period: day `dueDay` of the month after the period. */
export function dueDate(periodKey: string, dueDay: number): string {
  return `${addMonths(periodKey, 1)}-${String(dueDay).padStart(2, '0')}`;
}
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
}

export type PeriodState = 'not_needed' | 'late' | 'on_time' | 'upcoming' | 'open' | 'missing';
export function periodState(p: { periodKey: string; dueDay: number; uploadedAt: string | null; na: boolean; today?: string }): PeriodState {
  const today = p.today || isoDay();
  if (p.na) return 'not_needed';
  const due = dueDate(p.periodKey, p.dueDay);
  if (p.uploadedAt) return p.uploadedAt.slice(0, 10) > due ? 'late' : 'on_time';
  if (p.periodKey > monthKey(new Date(today))) return 'upcoming';
  if (today <= due) return 'open';
  return 'missing';
}

export type CertState = 'expired' | 'expiring' | 'valid';
export function recordState(expiresOn: string, today: string = isoDay()): { state: CertState; days: number } {
  const days = daysBetween(today, expiresOn);
  if (days < 0) return { state: 'expired', days };
  if (days <= EXPIRY_WARN_DAYS) return { state: 'expiring', days };
  return { state: 'valid', days };
}

export function fileErrors(file: FileInfo | null): Errors {
  if (!file) return { file: 'Choose a file.' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return { file: 'File type not allowed. Use PDF, Word, Excel, DWG or ZIP.' };
  if (file.size > MAX_BYTES) return { file: 'File is over 50 MB.' };
  if (file.size === 0) return { file: 'File is empty.' };
  return {};
}

export function summaryErrors(summary: string): Errors {
  const s = (summary || '').trim();
  if (s.length < 20) return { summary: `Write at least 20 characters (${s.length} now).` };
  if (s.length > 280) return { summary: 'Summary is over 280 characters.' };
  return {};
}

export interface RevisionInput {
  uploader: string; checker: string; approver: string; reason: string;
  summary: string; note: string; file: FileInfo | null;
}
/* Controlled documents: uploader, checker and approver must be three different people. */
export function revisionErrors(i: RevisionInput): Errors {
  const e: Errors = { ...fileErrors(i.file), ...summaryErrors(i.summary) };
  if (!REASONS.includes(i.reason)) e.reason = 'Choose a reason.';
  if ((i.note || '').trim().length < 10) e.note = 'Write at least 10 characters for the checker.';
  if (!i.checker) e.checker = 'Choose a checker.';
  if (!i.approver) e.approver = 'Choose an approver.';
  if (i.checker && i.checker === i.uploader) e.checker = 'The checker cannot be the uploader.';
  if (i.approver && i.approver === i.uploader) e.approver = 'The approver cannot be the uploader.';
  if (i.checker && i.approver && i.checker === i.approver) e.approver = 'Approver must differ from the checker.';
  return e;
}

export interface RevisionState { status: RevStatus; by: string; checker: string; approver: string }
export function canCheck(rev: RevisionState, actor: string): string | null {
  if (rev.status !== 'Submitted') return 'This revision is not waiting for a check.';
  if (actor === rev.by) return 'You added this revision, so you cannot check it.';
  if (actor !== rev.checker) return `Only ${rev.checker} can check this revision.`;
  return null;
}
export function canApprove(rev: RevisionState, actor: string): string | null {
  if (rev.status !== 'Checked') return 'This revision is not waiting for approval.';
  if (actor === rev.by || actor === rev.checker) return 'The approver must differ from the uploader and the checker.';
  if (actor !== rev.approver) return `Only ${rev.approver} can approve this revision.`;
  return null;
}
export function canReturn(rev: RevisionState, actor: string): string | null {
  if (rev.status !== 'Submitted' && rev.status !== 'Checked') return 'This revision is not waiting.';
  if (actor !== rev.checker && actor !== rev.approver) return 'Only the checker or approver can send a revision back.';
  return null;
}

/* Recurring series: the owner or the Records Lead may upload. */
export function canUploadSeries(owner: string, actor: string, isRecordsLead: boolean): string | null {
  if (isRecordsLead || actor === owner) return null;
  return `Only ${owner} or the Records Lead can upload to this series.`;
}
export function periodErrors(p: { file: FileInfo | null; summary: string; replaceReason: string; existing: boolean }): Errors {
  const e: Errors = { ...fileErrors(p.file), ...summaryErrors(p.summary) };
  if (p.existing && (p.replaceReason || '').trim().length < 10) e.replaceReason = 'Say why you are replacing it (10+ characters).';
  return e;
}
export function naErrors(reason: string): Errors {
  return (reason || '').trim().length < 10 ? { naReason: 'Give a reason of at least 10 characters.' } : {};
}
export function renewalErrors(r: { file: FileInfo | null; summary: string; expiresOn: string; today?: string }): Errors {
  const e: Errors = { ...fileErrors(r.file), ...summaryErrors(r.summary) };
  const today = r.today || isoDay();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiresOn || '') || r.expiresOn <= today) e.expiresOn = 'Enter an expiry date after today.';
  return e;
}

/* Removal and restore are for the Records Lead only. Removal needs a reason. */
export function canRemove(isRecordsLead: boolean): string | null {
  return isRecordsLead ? null : 'Only the Records Lead can remove a document.';
}
export function removeErrors(reason: string, text: string): Errors {
  const e: Errors = {};
  if (!reason) e.reason = 'Choose a reason.';
  if ((text || '').trim().length < 20) e.text = 'Write at least 20 characters to say why.';
  return e;
}
