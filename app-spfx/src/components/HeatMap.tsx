import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import * as A from '../domain/activity';
import * as R from '../domain/rules';
import { Segmented, Btn, Section, row, C, MONO, hint, card } from './ui';

export interface HeatEntry { when: string; project: string | null }

const SHADES = ['#f0f0f3', '#cfe3fb', '#9ec6f7', '#5fa3f2', '#0071e3'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cellStyle = (level: number): React.CSSProperties => ({ background: SHADES[level], borderRadius: 4, height: 22, minWidth: 0 });

export function HeatMap(props: { entries: HeatEntry[]; projects: ProjectInfo[] }) {
  const [mode, setMode] = React.useState<'month' | 'year'>('month');
  const today = R.isoDay();
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [year, setYear] = React.useState(today.slice(0, 4));
  const shift = (n: number) => {
    if (mode === 'year') { setYear(String(Number(year) + n)); return; }
    const [y, m] = month.split('-').map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  };

  const prefix = mode === 'year' ? year : month;
  const counts = A.dailyCounts(props.entries, prefix);
  const days = mode === 'month' ? A.daysOfMonth(month) : [];
  // Year view: total per project per month.
  const monthTotal = (code: string, m: number) => {
    const byDay = counts.get(code);
    if (!byDay) return 0;
    let n = 0;
    byDay.forEach((c, day) => { if (Number(day.slice(5, 7)) === m) n += c; });
    return n;
  };
  const cellsOf = (code: string): number[] => mode === 'month'
    ? days.map(d => counts.get(code)?.get(d) || 0)
    : MONTHS.map((_, i) => monthTotal(code, i + 1));
  const max = Math.max(0, ...props.projects.flatMap(p => cellsOf(p.code)));
  const label = mode === 'month' ? new Date(month + '-01T00:00:00Z').toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : year;

  return (
    <Section title="Activity by project" right={
      <div style={row}>
        <Btn onClick={() => shift(-1)}>←</Btn>
        <span style={{ fontSize: 14, minWidth: 140, textAlign: 'center' }}>{label}</span>
        <Btn onClick={() => shift(1)}>→</Btn>
      </div>}>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 12 }}>
        <Segmented value={mode} onChange={v => setMode(v as 'month' | 'year')} options={[['month', 'Days of a month'], ['year', 'Months of a year']]} />
        <div style={{ ...row, fontSize: 12, color: C.soft }}>
          Less {SHADES.map((c, i) => <span key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, display: 'inline-block' }} />)} More
        </div>
      </div>
      {props.projects.length === 0 ? <div style={{ ...card, color: C.soft }}>No projects yet.</div> : (
        <div style={{ ...card, padding: 14, overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${mode === 'month' ? days.length : 12}, minmax(${mode === 'month' ? 18 : 48}px, 1fr))`, gap: 3, minWidth: mode === 'month' ? 760 : 620 }}>
            <div />
            {(mode === 'month' ? days.map(d => d.slice(8)) : MONTHS).map(h => (
              <div key={h} style={{ fontSize: 11, color: C.soft, textAlign: 'center', fontFamily: MONO }}>{h}</div>
            ))}
            {props.projects.map(p => (
              <React.Fragment key={p.code}>
                <div style={{ fontSize: 13, fontWeight: 500, alignSelf: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.code}</div>
                {cellsOf(p.code).map((n, i) => {
                  const day = mode === 'month' ? days[i] : `${year}-${String(i + 1).padStart(2, '0')}`;
                  const label = mode === 'month' ? `${p.code} · ${day}: ${n} change${n === 1 ? '' : 's'}` : `${p.code} · ${MONTHS[i]} ${year}: ${n} change${n === 1 ? '' : 's'}`;
                  return <div key={i} role="img" aria-label={label} title={label} style={cellStyle(A.heatLevel(n, max))} />;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      <div style={{ ...hint, marginTop: 8 }}>Each square is the number of logged changes on that day (or month) for the project. Darker means more changes. Hover for the count.</div>
    </Section>
  );
}
