import * as React from 'react';
import type { DocumentRow, ProjectInfo } from '../domain/types';
import { Register } from '../services/register';
import { Btn, Pill, Select, Title, Notice, Table, th, td, input, row, C, MONO } from './ui';

const KIND: Record<string, string> = { controlled: 'Controlled', periodic: 'Recurring', record: 'Certificate', working: 'Uncontrolled' };

export function DocumentList(props: { reg: Register; projects: ProjectInfo[]; onOpen: (id: number) => void; onAdd: () => void }) {
  const [docs, setDocs] = React.useState<DocumentRow[] | null>(null);
  const [project, setProject] = React.useState('');
  const [kind, setKind] = React.useState('');
  const [q, setQ] = React.useState('');
  const [err, setErr] = React.useState('');
  const [showRemoved, setShowRemoved] = React.useState(false);

  React.useEffect(() => {
    props.reg.documents(project || undefined).then(setDocs).catch(e => setErr(String(e.message || e)));
  }, [project]);

  const rows = (docs || []).filter(d => (showRemoved || !d.removed) && (!kind || d.kind === kind) &&
    (!q || `${d.number} ${d.title}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <Title sub="Click a document to open it.">Documents</Title>
        <Btn kind="primary" onClick={props.onAdd}>Add document</Btn>
      </div>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div style={{ ...row, marginBottom: 16 }}>
        <input aria-label="Search" type="search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} className="dr-field" style={{ ...input, maxWidth: 260, borderRadius: 980, padding: '8px 16px' }} />
        <Select label="Project" value={project} onChange={setProject} placeholder="All projects" options={props.projects.map(p => [p.code, p.name])} />
        <Select label="Kind" value={kind} onChange={setKind} placeholder="All kinds" options={Object.entries(KIND)} />
        <label style={{ fontSize: 14, color: C.soft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} /> Show removed
        </label>
      </div>
      <Table minWidth={680}>
        <thead><tr><th style={th}>Number</th><th style={th}>Title</th><th style={th}>Kind</th><th style={th}>Folder</th></tr></thead>
        <tbody>
          {docs === null && !err ? <tr><td style={{ ...td, color: C.soft }} colSpan={4}>Loading…</td></tr> : null}
          {docs !== null && rows.length === 0 ? <tr><td style={{ ...td, color: C.soft, textAlign: 'center' }} colSpan={4}>No documents match.</td></tr> : null}
          {rows.map(d => (
            <tr key={d.id} className="dr-row" onClick={() => props.onOpen(d.id)} style={{ cursor: 'pointer' }}>
              <td style={{ ...td, fontFamily: MONO, fontSize: 13, color: C.soft }}>{d.number}{d.removed ? <> <Pill tone="bad">Removed</Pill></> : null}</td>
              <td style={{ ...td, fontWeight: 600 }}>{d.title}</td>
              <td style={td}><Pill tone={d.kind === 'controlled' ? 'check' : d.kind === 'periodic' ? 'ok' : 'wait'}>{KIND[d.kind]}</Pill></td>
              <td style={{ ...td, color: C.soft, fontSize: 14 }}>{d.folder.split('/').join(' › ')}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
