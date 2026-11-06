/* Dashboard calculations. Pure: takes plain data, returns what the dashboard shows. */
// .ts extension so Node's test runner can load it; tsc rejects it without allowImportingTsExtensions.
// @ts-ignore
import * as R from './rules.ts';
// @ts-ignore .ts extension so Node's test runner can load it (see dashboard.ts).
import * as SR from './series.ts';
import type { DocKind } from './rules.ts';

export interface DashDoc { id: number; number: string; title: string; project: string; kind: DocKind; owner: string; removed: boolean; dueDay: number | null; startPeriod: string | null; pausedFrom?: string; pausedTo?: string; endedOn?: string }
export interface DashRev { documentId: number; n: number; status: string; checker: string; approver: string; by: string }
export interface DashPeriod { documentId: number; periodKey: string; notNeeded: boolean; uploadedAt: string | null }
export interface DashCert { documentId: number; n: number; expiresOn: string }
export interface DashProject { code: string; name: string }

export interface WaitingItem { docId: number; text: string; detail: string; kind: 'check' | 'approve' | 'missing' | 'expiring' | 'expired' }
export interface ProjectProgress { code: string; name: string; controlledTotal: number; controlledApproved: number; periodsDue: number; periodsOnTime: number }
export interface Dashboard {
  waitingForMe: WaitingItem[]; missingPeriods: number; latePeriods: number; expiring: number; expired: number; progress: ProjectProgress[];
}

/* Years and months from the series start up to this month, as keys like 2026-10. */
export function periodKeysUpTo(start: string, today: string): string[] {
  const out: string[] = [];
  const end = R.monthKey(new Date(today));
  for (let k = start; k <= end; k = R.addMonths(k, 1)) out.push(k);
  return out;
}

export function buildDashboard(a: {
  me: string; today: string; projects: DashProject[]; docs: DashDoc[];
  revisions: DashRev[]; periods: DashPeriod[]; certificates: DashCert[];
}): Dashboard {
  const docById = new Map(a.docs.map(d => [d.id, d]));
  const live = a.docs.filter(d => !d.removed);
  const waitingForMe: WaitingItem[] = [];

  for (const r of a.revisions) {
    const d = docById.get(r.documentId);
    if (!d || d.removed) continue;
    if (r.status === 'Submitted' && r.checker === a.me) waitingForMe.push({ docId: d.id, kind: 'check', text: `${d.number} is waiting for your check`, detail: `Rev ${r.n} · ${d.title}` });
    if (r.status === 'Checked' && r.approver === a.me) waitingForMe.push({ docId: d.id, kind: 'approve', text: `${d.number} is waiting for your approval`, detail: `Rev ${r.n} · ${d.title}` });
  }

  let missing = 0, late = 0;
  const progress: ProjectProgress[] = a.projects.map(p => ({ code: p.code, name: p.name, controlledTotal: 0, controlledApproved: 0, periodsDue: 0, periodsOnTime: 0 }));
  const progressOf = (code: string) => progress.find(p => p.code === code);

  for (const d of live) {
    const pr = progressOf(d.project);
    if (d.kind === 'controlled' && pr) {
      pr.controlledTotal++;
      if (a.revisions.some(r => r.documentId === d.id && r.status === 'Approved')) pr.controlledApproved++;
    }
    if (d.kind === 'periodic' && d.dueDay && d.startPeriod) {
      const due = SR.dueMonths({ startPeriod: d.startPeriod, pausedFrom: d.pausedFrom || undefined, pausedTo: d.pausedTo || undefined, endedOn: d.endedOn || undefined }, a.today);
      for (const key of due) {
        const entries = a.periods.filter(p => p.documentId === d.id && p.periodKey === key);
        const upload = entries.find(e => !e.notNeeded && e.uploadedAt);
        const na = !upload && entries.some(e => e.notNeeded);
        const state = R.periodState({ periodKey: key, dueDay: d.dueDay, uploadedAt: upload ? upload.uploadedAt : null, na, today: a.today });
        if (pr) { pr.periodsDue++; if (state === 'on_time' || state === 'not_needed') pr.periodsOnTime++; }
        if (state === 'missing') { missing++; if (d.owner === a.me) waitingForMe.push({ docId: d.id, kind: 'missing', text: `${d.number}: ${key} is missing`, detail: `${d.title} · due ${R.dueDate(key, d.dueDay)}` }); }
        if (state === 'late') late++;
      }
    }
  }

  let expiring = 0, expired = 0;
  for (const d of live.filter(x => x.kind === 'record')) {
    const v = a.certificates.filter(c => c.documentId === d.id).sort((x, y) => y.n - x.n)[0];
    if (!v) continue;
    const s = R.recordState(v.expiresOn, a.today);
    if (s.state === 'expired') { expired++; if (d.owner === a.me) waitingForMe.push({ docId: d.id, kind: 'expired', text: `${d.number} has expired`, detail: `${d.title} · expired ${v.expiresOn}` }); }
    if (s.state === 'expiring') { expiring++; if (d.owner === a.me) waitingForMe.push({ docId: d.id, kind: 'expiring', text: `${d.number} expires in ${s.days} days`, detail: `${d.title} · ${v.expiresOn}` }); }
  }
  return { waitingForMe, missingPeriods: missing, latePeriods: late, expiring, expired, progress };
}
