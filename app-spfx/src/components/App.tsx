import * as React from 'react';
import type { ProjectInfo, AuditRow } from '../domain/types';
import { Register, Me } from '../services/register';
import { DocumentList } from './DocumentList';
import { DocumentPage } from './DocumentPage';
import { AddDocument } from './AddDocument';
import { Btn, Notice, card, row, C } from './ui';

type View = { kind: 'list' } | { kind: 'doc'; id: number } | { kind: 'add' } | { kind: 'log' };

export interface AppProps { context: unknown; siteUrl: string }

export function App(props: AppProps) {
  const [reg, setReg] = React.useState<Register | null>(null);
  const [me, setMe] = React.useState<Me | null>(null);
  const [projects, setProjects] = React.useState<ProjectInfo[]>([]);
  const [members, setMembers] = React.useState<string[]>([]);
  const [view, setView] = React.useState<View>({ kind: 'list' });
  const [err, setErr] = React.useState('');
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    if (!props.siteUrl) return;
    let cancelled = false;
    try {
      const r = new Register(props.context, props.siteUrl);
      setReg(r);
      Promise.all([r.whoAmI(), r.projects(), r.members()]).then(([m, p, mem]) => {
        if (cancelled) return;
        setMe(m); setProjects(p.filter(x => x.status === 'active')); setMembers(mem);
      }).catch(e => setErr(`Could not reach the register at ${props.siteUrl}. ${String(e.message || e)}`));
    } catch (e) { setErr(String((e as Error).message || e)); }
    return () => { cancelled = true; };
  }, [props.siteUrl]);

  if (!props.siteUrl) return <Notice tone="info">Set the SharePoint site address in the web part settings (Edit web part, then the site address box).</Notice>;
  if (err) return <Notice tone="bad">{err}</Notice>;
  if (!reg || !me) return <div style={{ color: C.soft }}>Signing you in and loading the register…</div>;

  const bump = () => setVersion(v => v + 1);
  return (
    <div style={{ fontFamily: 'Segoe UI, system-ui, sans-serif', color: C.ink }} data-version={version}>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: C.soft }}>Signed in as <b style={{ color: C.ink }}>{me.name}</b>{me.isRecordsLead ? ' · Records Lead' : ''}</div>
        <div style={row}>
          <Btn kind={view.kind === 'list' || view.kind === 'doc' ? 'primary' : 'plain'} onClick={() => setView({ kind: 'list' })}>Documents</Btn>
          <Btn kind={view.kind === 'log' ? 'primary' : 'plain'} onClick={() => setView({ kind: 'log' })}>Activity</Btn>
        </div>
      </div>
      {view.kind === 'list' ? <DocumentList key={version} reg={reg} projects={projects} onOpen={id => setView({ kind: 'doc', id })} onAdd={() => setView({ kind: 'add' })} /> : null}
      {view.kind === 'doc' ? <DocumentPage reg={reg} id={view.id} me={me} members={members} onBack={() => setView({ kind: 'list' })} onChanged={bump} /> : null}
      {view.kind === 'add' ? <AddDocument reg={reg} me={me} projects={projects} members={members} onCancel={() => setView({ kind: 'list' })} onDone={id => { bump(); setView({ kind: 'doc', id }); }} /> : null}
      {view.kind === 'log' ? <ActivityPage reg={reg} /> : null}
    </div>
  );
}

function ActivityPage(props: { reg: Register }) {
  const [rows, setRows] = React.useState<AuditRow[] | null>(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { props.reg.audit(undefined, 200).then(setRows).catch(e => setErr(String(e.message || e))); }, []);
  return (
    <div>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Activity</h1>
      <p style={{ color: C.soft, margin: '0 0 14px' }}>Every action, newest first. Entries are added, never edited.</p>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div style={card}>
        {rows === null ? 'Loading…' : rows.map(a => (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
            <span style={{ color: C.soft, fontSize: 13 }}>{a.when.slice(0, 16).replace('T', ' ')} · {a.who}</span>
            <span><b>{a.action}</b> {a.docNumber} {a.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
