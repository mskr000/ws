import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import { Register } from '../services/register';
import { Btn, Pill, card, C } from './ui';
import { ProjectForm } from './ProjectForm';

export function ProjectsPage(props: { reg: Register; projects: ProjectInfo[]; isRecordsLead: boolean; onChanged: () => void }) {
  const [editing, setEditing] = React.useState<{ code: string | null } | null>(null);
  if (editing) return <ProjectForm reg={props.reg} code={editing.code} isRecordsLead={props.isRecordsLead}
    onDone={() => { setEditing(null); props.onChanged(); }} onCancel={() => setEditing(null)} />;
  return (
    <div>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Projects</h1>
      <p style={{ color: C.soft, margin: '0 0 14px' }}>
        Each project has its own code, numbering, folders and document types. {props.isRecordsLead ? '' : 'Only the Records Lead can add or change a project.'}
      </p>
      {props.isRecordsLead ? <div style={{ textAlign: 'right', marginBottom: 10 }}><Btn kind="primary" onClick={() => setEditing({ code: null })}>+ Add project</Btn></div> : null}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>{['Code', 'Name', 'Status', 'Numbering', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, textTransform: 'uppercase', color: C.soft, borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {props.projects.length === 0 ? <tr><td colSpan={5} style={{ padding: 20, color: C.soft }}>No projects yet.</td></tr> : null}
            {props.projects.map(p => (
              <tr key={p.code} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ padding: 10 }}><b style={{ fontFamily: 'Consolas, monospace' }}>{p.code}</b></td>
                <td style={{ padding: 10 }}>{p.name}</td>
                <td style={{ padding: 10 }}><Pill tone={p.status === 'active' ? 'ok' : 'old'}>{p.status === 'active' ? 'Active' : 'Archived'}</Pill></td>
                <td style={{ padding: 10, fontFamily: 'Consolas, monospace', fontSize: 12, color: C.soft }}>{p.numberPattern}</td>
                <td style={{ padding: 10 }}><Btn kind="link" onClick={() => setEditing({ code: p.code })}>{props.isRecordsLead ? 'Open setup' : 'View setup'}</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
