import * as React from 'react';
import type { Dashboard } from '../domain/dashboard';
import type { ProjectInfo } from '../domain/types';
import * as R from '../domain/rules';
import * as A from '../domain/activity';
import { Register, Me } from '../services/register';
import { HeatMap, HeatEntry } from './HeatMap';
import { Title, Section, Notice, Table, th, td, card, row, C, hint, Btn } from './ui';

const KPI_HELP: Record<string, string> = {
  'Needs you': 'Checks, approvals and alerts waiting for you',
  'Missing uploads': 'Monthly items past their due day with no upload',
  'Late uploads': 'Uploaded after the due day',
  'Expiring soon': 'Certificates that expire within 30 days',
  'Expired': 'Certificates that need renewal',
};

export function DashboardPage(props: { reg: Register; me: Me; onOpen: (id: number) => void; onGo?: (view: string) => void }) {
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [projects, setProjects] = React.useState<ProjectInfo[]>([]);
  const [heat, setHeat] = React.useState<HeatEntry[]>([]);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    props.reg.dashboard(props.me, R.isoDay()).then(setData).catch(e => setErr(String((e as Error).message || e)));
    Promise.all([props.reg.projects(), props.reg.audit(undefined, 5000), props.reg.documents()]).then(([ps, all, docs]) => {
      const active = ps.filter(p => p.status === 'active');
      const docProject: Record<string, string> = {};
      docs.forEach(d => { docProject[d.number] = d.project; });
      const codes = active.map(p => p.code);
      setProjects(active);
      setHeat(all.map(a => ({ when: a.when, project: A.projectOf(a, docProject, codes) })));
    }).catch(() => setHeat([]));
  }, []);

  if (err) return <Notice tone="bad">{err}</Notice>;
  if (!data) return <div style={hint}>Loading the dashboard…</div>;

  const kpis: Array<[string, number]> = [
    ['Needs you', data.waitingForMe.length], ['Missing uploads', data.missingPeriods], ['Late uploads', data.latePeriods],
    ['Expiring soon', data.expiring], ['Expired', data.expired],
  ];
  return (
    <div>
      <Title sub={`As of ${R.isoDay()}. Numbers come from the register, not from a saved copy.`}>Dashboard</Title>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {kpis.map(([label, n]) => {
          const alarm = n > 0 && label !== 'Needs you';
          return (
            <div key={label} style={{ ...card, marginBottom: 0, borderTop: `3px solid ${alarm ? C.bad : C.accent}` }}>
              <div style={{ fontSize: 13, color: C.soft }}>{label}</div>
              <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5, color: alarm ? C.bad : C.ink }}>{n}</div>
              <div style={{ fontSize: 12, color: C.soft, marginTop: 4 }}>{KPI_HELP[label]}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        <Section title="Needs you">
          {data.waitingForMe.length === 0 ? <div style={{ ...card, color: C.soft }}>Nothing is waiting for you.</div> : (
            <div style={{ ...card, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
              {data.waitingForMe.map((w, i) => (
                <div key={i} style={{ ...row, justifyContent: 'space-between', flexWrap: 'nowrap', padding: '10px 16px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{w.text}</div>
                    <div style={{ fontSize: 13, color: C.soft }}>{w.detail}</div>
                  </div>
                  <Btn kind="link" label={`Open ${w.text}`} onClick={() => props.onOpen(w.docId)}>Open</Btn>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Progress by project">
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <Table minWidth={420}>
              <thead><tr><th style={th}>Project</th><th style={th}>Controlled approved</th><th style={th}>Recurring on time</th></tr></thead>
              <tbody>
                {data.progress.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={3}>No projects yet.</td></tr> : null}
                {data.progress.map(p => (
                  <tr key={p.code} className="dr-row">
                    <td style={td}><div style={{ fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 13, color: C.soft }}>{p.code}</div></td>
                    <td style={td}><Bar done={p.controlledApproved} total={p.controlledTotal} /></td>
                    <td style={td}><Bar done={p.periodsOnTime} total={p.periodsDue} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Section>
      </div>

      <div style={{ marginTop: 6 }}>
        <HeatMap entries={heat} projects={projects} />
      </div>
    </div>
  );
}

function Bar(props: { done: number; total: number }) {
  if (!props.total) return <span style={{ color: C.soft, fontSize: 14 }}>Nothing yet</span>;
  const pct = Math.round((props.done / props.total) * 100);
  return (
    <div style={{ ...row, flexWrap: 'nowrap' }}>
      <div style={{ flex: 1, minWidth: 70, height: 8, background: C.line, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.ok : C.accent }} />
      </div>
      <span style={{ fontSize: 13, minWidth: 84 }}>{props.done} of {props.total} · {pct}%</span>
    </div>
  );
}
