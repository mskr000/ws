/* Master document list: every folder of a project, with what is filed in it and where each document stands. Pure. */
// @ts-ignore .ts extension so Node's test runner can load it (see dashboard.ts).
import * as R from './rules.ts';

export interface MasterDoc { id: number; number: string; title: string; kind: string; folder: string; removed: boolean }
export interface MasterRev { documentId: number; n: number; status: string; createdAt: string }
export interface MasterPeriod { documentId: number; periodKey: string; notNeeded: boolean; uploadedAt: string | null }
export interface MasterCert { documentId: number; n: number; expiresOn: string }

export interface MasterRow { number: string; title: string; kind: string; standing: string; attention: boolean }
export interface MasterFolder { folder: string; rows: MasterRow[] }

/* One line of standing per document, in plain words. */
export function standingOf(d: MasterDoc, revs: MasterRev[], periods: MasterPeriod[], certs: MasterCert[], today: string): { text: string; attention: boolean } {
  if (d.removed) return { text: 'Removed', attention: false };
  if (d.kind === 'controlled') {
    const approved = revs.filter(r => r.status === 'Approved').sort((a, b) => b.n - a.n)[0];
    const last = revs.slice().sort((a, b) => b.n - a.n)[0];
    if (!last) return { text: 'Nothing filed yet', attention: true };
    if (approved) return { text: last.n === approved.n ? `Current: rev ${approved.n}` : `Current: rev ${approved.n}. Rev ${last.n} is ${last.status.toLowerCase()}`, attention: last.status === 'Returned' || last.status === 'Submitted' || last.status === 'Checked' };
    return { text: `Rev ${last.n}, not yet approved`, attention: true };
  }
  if (d.kind === 'periodic') {
    const keys = periods.filter(p => !p.notNeeded && p.uploadedAt).map(p => p.periodKey).sort();
    const latest = keys[keys.length - 1];
    const cur = R.monthKey(new Date(today));
    const attention = !latest || latest < cur;
    return { text: latest ? `Latest upload ${latest}` : 'Nothing uploaded yet', attention };
  }
  if (d.kind === 'record') {
    const c = certs.slice().sort((a, b) => b.n - a.n)[0];
    if (!c) return { text: 'No certificate on file', attention: true };
    const s = R.recordState(c.expiresOn, today);
    return { text: `Expires ${c.expiresOn}${s.state === 'valid' ? '' : ` (${s.state})`}`, attention: s.state !== 'valid' };
  }
  return { text: 'Working file', attention: false };
}

/* Every folder in the structure, even empty ones (those are planned but nothing is filed there yet). */
export function masterList(folders: string[], docs: MasterDoc[], revs: MasterRev[], periods: MasterPeriod[], certs: MasterCert[], today: string): MasterFolder[] {
  return [...folders].sort().map(folder => {
    const rows = docs.filter(d => d.folder === folder).sort((a, b) => a.number.localeCompare(b.number)).map(d => {
      const s = standingOf(d, revs.filter(r => r.documentId === d.id), periods.filter(p => p.documentId === d.id), certs.filter(c => c.documentId === d.id), today);
      return { number: d.number, title: d.title, kind: d.kind, standing: s.text, attention: s.attention };
    });
    return { folder, rows };
  });
}
