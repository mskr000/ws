import * as React from 'react';
import type { DocumentRow, ProjectInfo } from '../domain/types';
import { Register } from '../services/register';
import { Btn, Pill, Select, input, row, card, C } from './ui';

const KIND: Record<string, string> = { controlled: 'Controlled', periodic: 'Recurring', record: 'Certificate' };

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
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Documents</h1>
      <p style={{ color: C.soft, margin: '0 0 14px' }}>Click a document to open it.</p>
      {err ? <div role="alert" style={{ color: C.bad }}>{err}</div> : null}
      <div style={{ ...row, marginBottom: 12 }}>
        <input aria-label="Search" type="search" placeholder="Search number or title" value={q} onChange={e => setQ(e.target.value)} style={{ ...input, maxWidth: 280 }} />
        <Select label="Project" value={project} onChange={setProject} placeholder="All projects" options={props.projects.map(p => [p.code, p.name])} />
        <Select label="Kind" value={kind} onChange={setKind} placeholder="All kinds" options={Object.entries(KIND)} />
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} /> Show removed</label>
        <span style={{ flex: 1 }} />
        <Btn kind="primary" onClick={props.onAdd}>+ Add</Btn>
      </div>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr>{['Number', 'Title', 'Kind', 'Folder', 'Where it stands'].map(h => <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, textTransform: 'uppercase', color: C.soft, borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {docs === null ? <tr><td colSpan={5} style={{ padding: 20, color: C.soft }}>Loading…</td></tr> : null}
            {docs !== null && rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 20, color: C.soft }}>No documents match.</td></tr> : null}
            {rows.map(d => (
              <tr key={d.id} onClick={() => props.onOpen(d.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${C.line}` }}>
                <td style={{ padding: 10, fontFamily: 'Consolas, monospace', fontSize: 13, color: C.soft }}>{d.number}{d.removed ? <> <Pill tone="bad">Removed</Pill></> : null}</td>
                <td style={{ padding: 10, fontWeight: 650 }}>{d.title}</td>
                <td style={{ padding: 10 }}>{KIND[d.kind]}</td>
                <td style={{ padding: 10, fontSize: 13, color: C.soft }}>{d.folder.split('/').join(' › ')}</td>
                <td style={{ padding: 10, fontSize: 14 }}>{d.kind === 'periodic' ? 'Recurring' : d.kind === 'record' ? 'Certificate' : 'Controlled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
