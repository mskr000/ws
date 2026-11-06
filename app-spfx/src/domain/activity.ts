/* Activity heat map. Counts audit entries per project per day. Pure. */

export interface ActivityEntry { when: string; docNumber: string; detail: string }

/* The project an audit entry belongs to. Document entries use the document's project. Project entries start with the code. */
export function projectOf(e: ActivityEntry, docProject: Record<string, string>, codes: string[]): string | null {
  if (e.docNumber && docProject[e.docNumber]) return docProject[e.docNumber];
  const head = (e.detail || '').split(/[ ·]/)[0];
  return codes.includes(head) ? head : null;
}

/* Counts per project per day (YYYY-MM-DD), for entries whose day starts with a given prefix (YYYY or YYYY-MM). */
export function dailyCounts(entries: Array<{ when: string; project: string | null }>, prefix: string): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (!e.project) continue;
    const day = e.when.slice(0, 10);
    if (!day.startsWith(prefix)) continue;
    const byDay = out.get(e.project) || new Map<string, number>();
    byDay.set(day, (byDay.get(day) || 0) + 1);
    out.set(e.project, byDay);
  }
  return out;
}

/* Heat level 0 (none) to 4 (busiest). Scaled to the busiest cell shown. */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

/* Days of a month as YYYY-MM-DD. */
export function daysOfMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, '0')}`);
}
