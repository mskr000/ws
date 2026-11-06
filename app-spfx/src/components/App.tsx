import * as React from 'react';
import type { ProjectInfo, AuditRow } from '../domain/types';
import { Register, Me } from '../services/register';
import { DocumentList } from './DocumentList';
import { DocumentPage } from './DocumentPage';
import { AddDocument } from './AddDocument';
import { ProjectsPage } from './ProjectsPage';
import { Segmented, Title, Notice, Table, th, td, GLOBAL_CSS, C, FONT, MONO, hint, row } from './ui';

type View = { kind: 'list' } | { kind: 'doc'; id: number } | { kind: 'add' } | { kind: 'projects' } | { kind: 'log' };

export interface AppProps { context: unknown; siteUrl: string; /* Preview only: supply a register instead of SharePoint. */ registerFactory?: () => Register }

export function App(props: AppProps) {
  const [reg, setReg] = React.useState<Register | null>(null);
  const [me, setMe] = React.useState<Me | null>(null);
  const [allProjects, setAllProjects] = React.useState<ProjectInfo[]>([]);
  const [members, setMembers] = React.useState<string[]>([]);
  const [view, setView] = React.useState<View>({ kind: 'list' });
  const [err, setErr] = React.useState('');
  const [version, setVersion] = React.useState(0);
  const projects = allProjects.filter(p => p.status === 'active');
  const bump = () => setVersion(v => v + 1);

  React.useEffect(() => {
    if (!props.siteUrl && !props.registerFactory) return;
    let cancelled = false;
    try {
      const r = props.registerFactory ? props.registerFactory() : new Register(props.context, props.siteUrl);
      setReg(r);
      Promise.all([r.whoAmI(), r.projects(), r.members()]).then(([m, p, mem]) => {
        if (cancelled) return;
        setMe(m); setAllProjects(p); setMembers(mem);
      }).catch(e => setErr(`Could not reach the register at ${props.siteUrl}. ${String(e.message || e)}`));
    } catch (e) { setErr(String((e as Error).message || e)); }
    return () => { cancelled = true; };
  }, [props.siteUrl, props.registerFactory]);

  if (!props.siteUrl && !props.registerFactory) return <Notice tone="info">Set the SharePoint site address in the web part settings.</Notice>;
  if (err) return <Notice tone="bad">{err}</Notice>;
  if (!reg || !me) return <div style={{ ...hint, padding: 24 }}>Signing you in and loading the register…</div>;

  const section = view.kind === 'projects' ? 'projects' : view.kind === 'log' ? 'log' : 'documents';
  const pick = (v: string) => setView(v === 'projects' ? { kind: 'projects' } : v === 'log' ? { kind: 'log' } : { kind: 'list' });
  return (
    <div className="dr" style={{ fontFamily: FONT, color: C.ink }} data-version={version}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ ...row, justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 13, color: C.soft }}>Signed in as <span style={{ color: C.ink, fontWeight: 600 }}>{me.name}</span></div>
          {me.isRecordsLead ? <div style={{ ...hint, marginTop: 2 }}>Records Lead</div> : null}
        </div>
        <Segmented value={section} onChange={pick} options={[['documents', 'Documents'], ['projects', 'Projects'], ['log', 'Activity']]} />
      </div>

      {view.kind === 'list' ? <DocumentList key={version} reg={reg} projects={projects} onOpen={id => setView({ kind: 'doc', id })} onAdd={() => setView({ kind: 'add' })} /> : null}
      {view.kind === 'doc' ? <DocumentPage reg={reg} id={view.id} me={me} members={members} onBack={() => setView({ kind: 'list' })} onChanged={bump} /> : null}
      {view.kind === 'add' ? <AddDocument reg={reg} me={me} projects={projects} members={members} onCancel={() => setView({ kind: 'list' })} onDone={id => { bump(); setView({ kind: 'doc', id }); }} /> : null}
      {view.kind === 'projects' ? <ProjectsPage reg={reg} projects={allProjects} isRecordsLead={me.isRecordsLead} onChanged={() => { reg.projects().then(setAllProjects).catch(() => undefined); bump(); }} /> : null}
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
      <Title sub="Every action, newest first. Entries are added, never edited.">Activity</Title>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <Table minWidth={620}>
        <thead><tr><th style={th}>When</th><th style={th}>Who</th><th style={th}>Action</th><th style={th}>Document</th><th style={th}>Detail</th></tr></thead>
        <tbody>
          {rows === null ? <tr><td style={td} colSpan={5}>Loading…</td></tr> : null}
          {rows && rows.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={5}>Nothing yet.</td></tr> : null}
          {(rows || []).map(a => (
            <tr key={a.id} className="dr-row">
              <td style={{ ...td, color: C.soft, fontSize: 13, whiteSpace: 'nowrap' }}>{a.when.slice(0, 16).replace('T', ' ')}</td>
              <td style={td}>{a.who}</td>
              <td style={{ ...td, fontWeight: 500 }}>{a.action}</td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 13 }}>{a.docNumber}</td>
              <td style={{ ...td, color: C.soft, fontSize: 14 }}>{a.detail}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
