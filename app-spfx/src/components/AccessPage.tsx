import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import * as P from '../domain/permissions';
import { Register, Me } from '../services/register';
import { Btn, Notice, Select, Title, Section, Table, th, td, card, row, C, hint } from './ui';

/* Admin only. Grants who can do what, for all projects or for one project or folder. */
export function AccessPage(props: { reg: Register; me: Me; projects: ProjectInfo[]; people: string[] }) {
  const [grants, setGrants] = React.useState<P.Grant[] | null>(null);
  const [person, setPerson] = React.useState(props.people[0] || '');
  const [project, setProject] = React.useState<string>(P.ALL_PROJECTS);
  const [folders, setFolders] = React.useState<string[]>([]);
  const [folder, setFolder] = React.useState('');
  const [cap, setCap] = React.useState<P.Cap>('remove');
  const [preset, setPreset] = React.useState('Records Lead');
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');

  const load = () => props.reg.grants().then(setGrants).catch(e => setErr(String((e as Error).message || e)));
  React.useEffect(() => { load(); }, []);
  React.useEffect(() => {
    setFolder('');
    if (project === P.ALL_PROJECTS) { setFolders([]); return; }
    props.reg.projectSetup(project).then(x => setFolders(x.setup.folders)).catch(() => setFolders([]));
  }, [project]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(''); setMsg('');
    try { await fn(); setMsg(ok); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
  };
  const scopeName = (g: { project: string; folder: string }) =>
    `${g.project === P.ALL_PROJECTS ? 'All projects' : g.project}${g.folder ? ' / ' + g.folder : ''}`;
  const projectOptions: Array<[string, string]> = [[P.ALL_PROJECTS, 'All projects'], ...props.projects.map(p => [p.code, `${p.name} (${p.code})`] as [string, string])];
  const folderOptions: Array<[string, string]> = [['', 'Whole project'], ...folders.map(f => [f, f] as [string, string])];
  const personGrants = (grants || []).filter(g => g.user === person);

  return (
    <div>
      <Title sub="Admins only. Choose who can do what, for all projects, one project, or one folder. Every change is logged.">Access</Title>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      {msg ? <Notice tone="ok">{msg}</Notice> : null}

      <Section title="Add a permission">
        <div style={card}>
          <div style={{ ...row, alignItems: 'flex-end' }}>
            <Select label="Person" value={person} onChange={setPerson} options={props.people.map(p => [p, p] as [string, string])} width={200} />
            <Select label="Project" value={project} onChange={setProject} options={projectOptions} width={260} />
            {project !== P.ALL_PROJECTS ? <Select label="Folder" value={folder} onChange={setFolder} options={folderOptions} width={320} /> : null}
          </div>
          <div style={{ ...row, alignItems: 'flex-end', marginTop: 14 }}>
            <Select label="Permission" value={cap} onChange={v => setCap(v as P.Cap)} options={P.CAPS.map(c => [c, P.CAP_LABEL[c]] as [string, string])} width={360} />
            <Btn kind="primary" disabled={!person} onClick={() => run(() => props.reg.addGrant({ user: person, project, folder, cap }), `Added for ${person}.`)}>Add permission</Btn>
          </div>
          <div style={{ ...row, alignItems: 'flex-end', marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
            <Select label="Or apply a role" value={preset} onChange={setPreset} options={Object.keys(P.PRESETS).filter(k => k !== 'Member').map(k => [k, k] as [string, string])} width={200} />
            <Btn disabled={!person} onClick={() => run(async () => {
              for (const g of P.presetGrants(preset, person, project, folder)) {
                const cur = (await props.reg.grants());
                if (P.grantErrors(g, cur)) continue; // already has it
                await props.reg.addGrant(g);
              }
            }, `${preset} applied to ${person} for ${project === P.ALL_PROJECTS ? 'all projects' : project}${folder ? ' / ' + folder : ''}.`)}>Apply role</Btn>
          </div>
          <div style={{ ...hint, marginTop: 10 }}>Members can always add documents and revisions. The permissions above cover upload to other people's documents, removing, project setup and access.</div>
        </div>
      </Section>

      <Section title={`Permissions for ${person || '…'}`}>
        {grants === null ? <div style={hint}>Loading…</div> : (
          <Table minWidth={560}>
            <thead><tr><th style={th}>Permission</th><th style={th}>Where</th><th style={th} /></tr></thead>
            <tbody>
              {personGrants.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={3}>No permissions. This person can add documents and revisions only.</td></tr> : null}
              {personGrants.map(g => (
                <tr key={g.id} className="dr-row">
                  <td style={td}>{P.CAP_LABEL[g.cap]}</td>
                  <td style={{ ...td, color: C.soft, fontSize: 14 }}>{scopeName(g)}</td>
                  <td style={{ ...td, textAlign: 'right' }}><Btn kind="link" onClick={() => run(() => props.reg.removeGrant(g), `Removed from ${person}.`)}>Remove</Btn></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Everyone with a permission">
        {grants === null ? null : (
          <Table minWidth={620}>
            <thead><tr><th style={th}>Person</th><th style={th}>Permission</th><th style={th}>Where</th></tr></thead>
            <tbody>
              {grants.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={3}>No permissions set yet.</td></tr> : null}
              {grants.map(g => (
                <tr key={g.id} className="dr-row">
                  <td style={td}>{g.user}</td>
                  <td style={td}>{P.CAP_LABEL[g.cap]}</td>
                  <td style={{ ...td, color: C.soft, fontSize: 14 }}>{scopeName(g)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}
