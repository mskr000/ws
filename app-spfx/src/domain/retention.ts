/* Retention and legal hold. Pure functions. Policy values are defaults until the policy is decided. */

/* Years a document is kept after its last activity before it may be removed. Default until policy is set. */
export const RETENTION_YEARS = 7;

export function addYears(isoDay: string, years: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
}

/* The most recent date among the document's activity. Falls back to today when there is none. */
export function lastActivity(dates: Array<string | null | undefined>, today: string): string {
  const real = dates.filter((d): d is string => !!d).map(d => d.slice(0, 10)).sort();
  return real.length ? real[real.length - 1] : today;
}

export function retentionUntil(lastActivityDay: string, years = RETENTION_YEARS): string {
  return addYears(lastActivityDay, years);
}

/* Why a document may not be removed now, or null when it may. */
export function removalBlock(p: { legalHold: boolean; lastActivityDay: string; today: string; years?: number }): string | null {
  if (p.legalHold) return 'Legal hold: this document cannot be removed or renamed until the hold is released.';
  const until = retentionUntil(p.lastActivityDay, p.years ?? RETENTION_YEARS);
  if (until > p.today) return `Retention: keep until ${until}. It can be removed after that date.`;
  return null;
}

export function holdErrors(reason: string): Record<string, string> {
  return (reason || '').trim().length < 10 ? { reason: 'Write at least 10 characters to say why.' } : {};
}
