import * as React from 'react';
import type { Dashboard } from '../domain/dashboard';
import * as R from '../domain/rules';
import { Register, Me } from '../services/register';
import { Title, Section, Notice, Table, th, td, card, row, C, hint } from './ui';

const KPI_HELP: Record<string, string> = {
  'Needs you': 'Checks, approvals, and alerts waiting for you',
  'Missing uploads': 'Monthly items past their due day with no upload',
  'Late uploads': 'Uploaded after the due day',
  'Expiring soon': 'Certificates that expire within 30 days',
  'Expired': 'Certificates that need renewal',
};

export function DashboardPage(props: { reg: Register; me: Me; onOpen: (id: number) => void }) {
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    props.reg.dashboard(props.me, R.isoDay()).then(setData).catch(e => setErr(String((e as Error).message || e)));
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(([label, n]) => (
          <div key={label} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 13, color: C.soft }}>{label}</div>
            <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5, color: n > 0 && label !== 'Needs you' ? C.bad : C.ink }}>{n}</div>
            <div style={{ fontSize: 12, color: C.soft, marginTop: 4 }}>{KPI_HELP[label]}</div>
          </div>
        ))}
      </div>

      <Section title="Needs you">
        {data.waitingForMe.length === 0 ? <div style={{ ...hint, padding: '4px 2px' }}>Nothing is waiting for you.</div> : (
          <Table minWidth={560}>
            <thead><tr><th style={th}>What</th><th style={th}>Detail</th><th style={th} /></tr></thead>
            <tbody>
              {data.waitingForMe.map((w, i) => (
                <tr key={i} className="dr-row">
                  <td style={{ ...td, fontWeight: 500 }}>{w.text}</td>
                  <td style={{ ...td, color: C.soft, fontSize: 14 }}>{w.detail}</td>
                  <td style={td}><button className="dr-link" onClick={() => props.onOpen(w.docId)} style={linkBtn}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Progress by project">
        <Table minWidth={560}>
          <thead><tr><th style={th}>Project</th><th style={th}>Controlled documents approved</th><th style={th}>Recurring uploads on time</th></tr></thead>
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
      </Section>
    </div>
  );
}

function Bar(props: { done: number; total: number }) {
  if (!props.total) return <span style={{ color: C.soft, fontSize: 14 }}>Nothing yet</span>;
  const pct = Math.round((props.done / props.total) * 100);
  return (
    <div style={{ ...row, flexWrap: 'nowrap' }}>
      <div style={{ flex: 1, minWidth: 90, height: 8, background: C.line, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.ok : C.accent }} />
      </div>
      <span style={{ fontSize: 14, minWidth: 92 }}>{props.done} of {props.total} · {pct}%</span>
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 14, padding: 0 };
