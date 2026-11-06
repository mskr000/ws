/* Choosing the files for a transmittal. Pure. Every candidate is one stored file, with its revision and status.
   Drafts are never candidates. Only the current approved version is chosen by default. */

export type FileStatus = 'current' | 'superseded' | 'in_review' | 'returned' | 'removed';

export interface CandidateFile {
  key: string;          // unique per file
  docId: number;
  number: string;
  title: string;
  folder: string;
  kind: string;
  version: string;      // "Rev 2", "Jun 2026", "Certificate v1", "v3"
  fileName: string;
  fileUrl: string;
  checksum: string;
  status: FileStatus;
  standing: string;     // plain words, e.g. "Current: Rev 1"
}

export const MAX_LINES = 200;

export const STATUS_WORDS: Record<FileStatus, string> = {
  current: 'Current', superseded: 'Older version', in_review: 'Not approved yet', returned: 'Sent back', removed: 'Removed',
};

/* A status that needs the sender to confirm before it goes out. */
export function needsConfirm(f: CandidateFile): boolean {
  return f.status !== 'current';
}

/* Only the current version is chosen by default. */
export function defaultChoice(files: CandidateFile[]): CandidateFile[] {
  return files.filter(f => f.status === 'current');
}

/* Document numbers pasted by hand. Any spaces, commas, semicolons or new lines separate them. Duplicates dropped. */
export function parseNumbers(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)));
}

export function filesFilter(files: CandidateFile[], q: { text?: string; status?: FileStatus | '' }): CandidateFile[] {
  const t = (q.text || '').trim().toLowerCase();
  return files.filter(f => (!q.status || f.status === q.status) &&
    (!t || f.number.toLowerCase().includes(t) || f.title.toLowerCase().includes(t) || f.fileName.toLowerCase().includes(t)));
}

export function pageOf<T>(items: T[], page: number, size: number): { items: T[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), pages, page: p };
}

/* Adding a file would go over the limit per transmittal. */
export function overLimit(count: number): string | null {
  return count > MAX_LINES ? `A transmittal can hold ${MAX_LINES} files. Split this into more than one transmittal.` : null;
}

/* The stored files of one document, each classified. Structural types keep this free of SharePoint code. */
export interface DocLike { id: number; number: string; title: string; folder: string; kind: string; removed: boolean }
export interface RevLike { id: number; n: number; status: string; fileName: string; fileUrl: string; checksum: string }
export interface PeriodLike { id: number; periodKey: string; version: number; notNeeded: boolean; uploadedAt: string | null; fileName: string; fileUrl: string; checksum: string }
export interface CertLike { id: number; n: number; expiresOn: string; fileName: string; fileUrl: string; checksum: string }

export function candidatesOf(doc: DocLike, revs: RevLike[], periods: PeriodLike[], certs: CertLike[]): CandidateFile[] {
  const base = { docId: doc.id, number: doc.number, title: doc.title, folder: doc.folder, kind: doc.kind };
  const out: CandidateFile[] = [];
  const removed = doc.removed;
  const add = (o: Omit<CandidateFile, keyof typeof base | 'key' | 'status' | 'standing'> & { key: string; status: FileStatus; standing: string }) =>
    out.push({ ...base, ...o, status: removed ? 'removed' : o.status });

  if (doc.kind === 'controlled') {
    const withFile = revs.filter(r => r.fileUrl);
    const approved = withFile.filter(r => r.status === 'Approved');
    const currentN = approved.length ? Math.max(...approved.map(r => r.n)) : -1;
    for (const r of withFile) {
      const version = `Rev ${r.n}`;
      let status: FileStatus; let standing: string;
      if (r.status === 'Approved' && r.n === currentN) { status = 'current'; standing = `Current: Rev ${r.n}`; }
      else if (r.status === 'Approved') { status = 'superseded'; standing = `Rev ${r.n} (older)`; }
      else if (r.status === 'Returned') { status = 'returned'; standing = `Rev ${r.n} sent back`; }
      else { status = 'in_review'; standing = `Rev ${r.n}, not yet approved`; }
      add({ key: `rev${r.id}`, version, fileName: r.fileName, fileUrl: r.fileUrl, checksum: r.checksum, status, standing });
    }
  } else if (doc.kind === 'working') {
    const versions = revs.filter(r => r.fileUrl && r.status === 'Working');
    const latest = versions.length ? Math.max(...versions.map(r => r.n)) : -1;
    for (const r of versions) {
      const status: FileStatus = r.n === latest ? 'current' : 'superseded';
      add({ key: `rev${r.id}`, version: `v${r.n}`, fileName: r.fileName, fileUrl: r.fileUrl, checksum: r.checksum, status, standing: status === 'current' ? `Latest version: v${r.n}` : `v${r.n} (older)` });
    }
  } else if (doc.kind === 'periodic') {
    const ups = periods.filter(p => p.fileUrl && !p.notNeeded);
    const latestByKey = new Map<string, number>();
    for (const p of ups) latestByKey.set(p.periodKey, Math.max(latestByKey.get(p.periodKey) ?? 0, p.version));
    for (const p of ups) {
      const isLatest = p.version === latestByKey.get(p.periodKey);
      add({ key: `per${p.id}`, version: `${p.periodKey} v${p.version}`, fileName: p.fileName, fileUrl: p.fileUrl, checksum: p.checksum,
        status: isLatest ? 'current' : 'superseded', standing: isLatest ? `Upload ${p.periodKey}` : `${p.periodKey} v${p.version} (older)` });
    }
  } else if (doc.kind === 'record') {
    const withFile = certs.filter(c => c.fileUrl);
    const latest = withFile.length ? Math.max(...withFile.map(c => c.n)) : -1;
    for (const c of withFile) {
      const isLatest = c.n === latest;
      add({ key: `cert${c.id}`, version: `Certificate v${c.n}`, fileName: c.fileName, fileUrl: c.fileUrl, checksum: c.checksum,
        status: isLatest ? 'current' : 'superseded', standing: isLatest ? `Expires ${c.expiresOn}` : `Certificate v${c.n} (older)` });
    }
  }
  return out;
}
