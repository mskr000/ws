import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import * as R from '../domain/rules';
import * as CAL from '../domain/calendar';
import * as M from '../domain/master';
import { csvCell } from '../domain/transmittal';
import { Register } from '../services/register';
import { saveText } from '../services/download';
import { Btn, Notice, Select, Title, Segmented, Section, Table, th, td, row, C, MONO, hint, card } from './ui';

type Data = Awaited<ReturnType<Register['planData']>>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL: Record<string, { bg: string; mark: string; ink: string }> = {
  on_time: { bg: C.okSoft, mark: '✓', ink: C.ok },
  late: { bg: C.warnSoft, mark: '!', ink: C.warn },
  missing: { bg: C.badSoft, mark: '×', ink: C.bad },
  open: { bg: C.accentSoft, mark: '•', ink: C.accent },
  upcoming: { bg: C.panel, mark: '', ink: C.soft },
  not_needed: { bg: C.muteSoft, mark: '–', ink: C.mute },
  before: { bg: 'transparent', mark: '', ink: C.soft },
};

export function PlanPage(props: { reg: Register; projects: ProjectInfo[] }) {
  const [project, setProject] = React.useState(props.projects[0]?.code || '');
  const [view, setView] = React.useState<'calendar' | 'master'>('calendar');
  const [year, setYear] = React.useState(Number(R.isoDay().slice(0, 4)));
  const [data, setData] = React.useState<Data | null>(null);
  const [err, setErr] = React.useState('');
  const today = R.isoDay();

  React.useEffect(() => {
    if (!project) return;
    let live = true;
    setData(null); setErr('');
    props.reg.planData(project).then(d => { if (live) setData(d); }).catch(e => { if (live) setErr(String((e as Error).message || e)); });
    return () => { live = false; };
  }, [project, props.reg]);

  const exportMaster = () => {
    if (!data) return;
    const rows = M.masterList(data.folders, data.docs, data.revs, data.periods, data.certs, today);
    const lines = [['Folder', 'Number', 'Title', 'Kind', 'Where it stands'].map(csvCell).join(',')];
    rows.forEach(f => {
      if (f.rows.length === 0) lines.push([f.folder, '', '', '', 'Nothing filed here yet'].map(csvCell).join(','));
      f.rows.forEach(r => lines.push([f.folder, r.number, r.title, r.kind, r.standing].map(csvCell).join(',')));
    });
    saveText(lines.join('\r\n'), `master-list-${project}-${today}.csv`);
  };

  return (
    <div>
      <Title sub="Plan for one project: when recurring documents are due, and what is filed where.">Plan</Title>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 16 }}>
        <Select label="Project" value={project} onChange={setProject} options={props.projects.map(p => [p.code, `${p.name} (${p.code})`])} width={320} />
        <Segmented value={view} onChange={v => setView(v as 'calendar' | 'master')} options={[['calendar', 'Calendar'], ['master', 'Master list']]} />
      </div>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      {!data && !err ? <div style={hint}>Loading the plan…</div> : null}

      {data && view === 'calendar' ? (
        <CalendarView data={data} year={year} setYear={setYear} today={today} />
      ) : null}

      {data && view === 'master' ? (
        <Section title="Master list" right={<Btn onClick={exportMaster}>Export CSV</Btn>}>
          <div style={{ ...hint, marginBottom: 10 }}>Every folder in the structure. Empty folders are planned but nothing is filed there yet. Red text needs attention.</div>
          {M.masterList(data.folders, data.docs, data.revs, data.periods, data.certs, today).map(f => (
            <div key={f.folder} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ ...row, justifyContent: 'space-between', padding: '12px 16px', background: C.bg, borderBottom: `1px solid ${C.line}` }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{f.folder.split('/').join(' › ')}</span>
                <span style={{ fontSize: 13, color: C.soft }}>{f.rows.length} document{f.rows.length === 1 ? '' : 's'}</span>
              </div>
              {f.rows.length === 0 ? <div style={{ padding: '12px 16px', color: C.soft, fontSize: 14 }}>Nothing filed here yet.</div> : (
                <Table minWidth={560}>
                  <tbody>
                    {f.rows.map(r => (
                      <tr key={r.number} className="dr-row">
                        <td style={{ ...td, fontFamily: MONO, fontSize: 13, whiteSpace: 'nowrap' }}>{r.number}</td>
                        <td style={td}>{r.title}</td>
                        <td style={{ ...td, color: r.attention ? C.bad : C.soft, fontSize: 14 }}>{r.standing}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function CalendarView(props: { data: Data; year: number; setYear: (y: number) => void; today: string }) {
  const series = props.data.docs.filter(d => d.kind === 'periodic' && !d.removed);
  return (
    <Section title={`Recurring documents, ${props.year}`} right={
      <div style={row}>
        <Btn onClick={() => props.setYear(props.year - 1)}>← {props.year - 1}</Btn>
        <Btn onClick={() => props.setYear(props.year + 1)}>{props.year + 1} →</Btn>
      </div>}>
      {series.length === 0 ? <div style={{ ...card, color: C.soft }}>No recurring documents in this project.</div> : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 760, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, position: 'sticky', left: 0, background: C.panel, minWidth: 220 }}>Document</th>
                {MONTHS.map(m => <th key={m} style={{ ...th, textAlign: 'center', padding: '12px 6px' }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.map(d => {
                const cells = CAL.yearCells({ startPeriod: d.startPeriod, dueDay: d.dueDay }, props.data.periods.filter(p => p.documentId === d.id), props.year, props.today);
                return (
                  <tr key={d.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: '12px 16px', position: 'sticky', left: 0, background: C.panel, borderRight: `1px solid ${C.line}` }}>
                      <div style={{ fontWeight: 500 }}>{d.title}</div>
                      <div style={{ fontSize: 12, color: C.soft, fontFamily: MONO }}>{d.number} · due day {d.dueDay}</div>
                    </td>
                    {cells.map(c => {
                      const st = CELL[c.state] || CELL.before;
                      return (
                        <td key={c.key} style={{ padding: 4, textAlign: 'center' }}>
                          <div role="img" aria-label={`${MONTHS[Number(c.key.slice(5)) - 1]} ${props.year}: ${c.label}`} title={`${c.key}: ${c.label}`}
                            style={{ height: 36, borderRadius: 8, background: st.bg, color: st.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 15, border: c.key === props.today.slice(0, 7) ? `1.5px solid ${C.accent}` : '1.5px solid transparent' }}>
                            {st.mark}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...row, marginTop: 12, fontSize: 13, color: C.soft }}>
        <Legend bg={C.okSoft} mark="✓" ink={C.ok} label="On time" />
        <Legend bg={C.warnSoft} mark="!" ink={C.warn} label="Late" />
        <Legend bg={C.badSoft} mark="×" ink={C.bad} label="Missing" />
        <Legend bg={C.accentSoft} mark="•" ink={C.accent} label="Due this month" />
        <Legend bg={C.muteSoft} mark="–" ink={C.mute} label="Not needed" />
      </div>
    </Section>
  );
}

function Legend(props: { bg: string; mark: string; ink: string; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 20, height: 20, borderRadius: 6, background: props.bg, color: props.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{props.mark}</span>{props.label}</span>;
}
