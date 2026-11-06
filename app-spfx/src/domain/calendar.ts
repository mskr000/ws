/* Twelve-month calendar for recurring series. Pure: one row per series, one cell per month. */
// @ts-ignore .ts extension so Node's test runner can load it (see dashboard.ts).
import * as R from './rules.ts';

export type CellState = R.PeriodState | 'before';

export interface CalCell { key: string; state: CellState; label: string }
export interface SeriesPeriod { periodKey: string; notNeeded: boolean; uploadedAt: string | null }

/* Twelve months of one year for one series. Months before the series start are 'before'. */
export function yearCells(series: { startPeriod: string | null; dueDay: number | null }, periods: SeriesPeriod[], year: number, today: string): CalCell[] {
  const out: CalCell[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    if (!series.startPeriod || !series.dueDay || key < series.startPeriod) {
      out.push({ key, state: 'before', label: 'Before the first month' });
      continue;
    }
    const entries = periods.filter(p => p.periodKey === key);
    const upload = entries.find(e => !e.notNeeded && e.uploadedAt);
    const na = !upload && entries.some(e => e.notNeeded);
    const state = R.periodState({ periodKey: key, dueDay: series.dueDay, uploadedAt: upload ? upload.uploadedAt : null, na, today });
    out.push({ key, state, label: STATE_WORDS[state] || state });
  }
  return out;
}

export const STATE_WORDS: Record<string, string> = {
  on_time: 'Uploaded on time', late: 'Uploaded late', missing: 'Missing', open: 'Due this month',
  upcoming: 'Not yet due', not_needed: 'Marked not needed', before: 'Before the first month',
};
