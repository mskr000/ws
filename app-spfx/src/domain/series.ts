/* Recurring series: which months are due. A series can be paused (no months due while paused) or ended (no months after the end).
   Nothing is deleted. Pure. */

export interface SeriesState {
  startPeriod: string | null;   // first month, YYYY-MM
  pausedFrom?: string;          // months from this one (inclusive) are not due, while paused
  pausedTo?: string;            // exclusive end of the pause. '' = still paused.
  endedOn?: string;             // last month that counts. '' = not ended.
}

export function addMonth(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/* Is this month excluded by a pause? */
export function isPaused(k: string, s: SeriesState): boolean {
  if (!s.pausedFrom) return false;
  return k >= s.pausedFrom && (!s.pausedTo || k < s.pausedTo);
}

/* Months that are due up to today, skipping paused months and stopping at the end. */
export function dueMonths(s: SeriesState, today: string): string[] {
  if (!s.startPeriod) return [];
  const current = today.slice(0, 7);
  const out: string[] = [];
  for (let k = s.startPeriod; k <= current; k = addMonth(k, 1)) {
    if (s.endedOn && k > s.endedOn) break;
    if (isPaused(k, s)) continue;
    out.push(k);
  }
  return out;
}

/* What the series is doing now, in plain words. */
export function seriesStatus(s: SeriesState, currentMonth: string): 'active' | 'paused' | 'ended' {
  if (s.endedOn && currentMonth >= s.endedOn) return 'ended'; // the end month is the last one that counts
  if (s.pausedFrom && (!s.pausedTo || currentMonth < s.pausedTo) && currentMonth >= s.pausedFrom) return 'paused';
  return 'active';
}

/* Pause from this month. Resuming later ends the pause; months in between stay not due. */
export function pause(s: SeriesState, currentMonth: string): SeriesState {
  if (s.endedOn) return s;
  return { ...s, pausedFrom: currentMonth, pausedTo: '' };
}

export function resume(s: SeriesState, currentMonth: string): SeriesState {
  if (!s.pausedFrom || s.pausedTo) return s;
  return { ...s, pausedTo: currentMonth };
}

/* Stop the series. The last month that counts is this month. Nothing after it is due. */
export function end(s: SeriesState, currentMonth: string): SeriesState {
  if (s.endedOn) return s;
  return { ...s, endedOn: currentMonth };
}
