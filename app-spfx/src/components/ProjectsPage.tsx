import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import { Register, Me } from '../services/register';
import * as P from '../domain/permissions';
import { Btn, Pill, Title, Table, th, td, row, C, MONO } from './ui';
import { ProjectForm } from './ProjectForm';

export function ProjectsPage(props: { reg: Register; me: Me; projects: ProjectInfo[]; onChanged: () => void }) {
  const canAdd = P.can(props.me, 'projects');
  const [editing, setEditing] = React.useState<{ code: string | null } | null>(null);
  if (editing) return <ProjectForm reg={props.reg} me={props.me} code={editing.code}
    onDone={() => { setEditing(null); props.onChanged(); }} onCancel={() => setEditing(null)} />;
  return (
    <div>
      <div style={{ ...row, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <Title sub={canAdd ? 'Each project has its own code, numbering, folders and document types.' : 'Each project has its own code, numbering, folders and document types. Changing them needs the projects permission.'}>Projects</Title>
        {canAdd ? <Btn kind="primary" onClick={() => setEditing({ code: null })}>Add project</Btn> : null}
      </div>
      <Table minWidth={560}>
        <thead><tr><th style={th}>Code</th><th style={th}>Name</th><th style={th}>Status</th><th style={th}>Numbering</th><th style={th}></th></tr></thead>
        <tbody>
          {props.projects.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={5}>No projects yet.</td></tr> : null}
          {props.projects.map(p => (
            <tr key={p.code} className="dr-row">
              <td style={{ ...td, fontFamily: MONO, fontWeight: 600 }}>{p.code}</td>
              <td style={{ ...td, fontWeight: 500 }}>{p.name}</td>
              <td style={td}><Pill tone={p.status === 'active' ? 'ok' : 'old'}>{p.status === 'active' ? 'Active' : 'Archived'}</Pill></td>
              <td style={{ ...td, fontFamily: MONO, fontSize: 13, color: C.soft }}>{p.numberPattern}</td>
              <td style={{ ...td, textAlign: 'right' }}><Btn kind="link" onClick={() => setEditing({ code: p.code })}>{P.can(props.me, 'projects', p.code) ? 'Edit' : 'View'}</Btn></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
