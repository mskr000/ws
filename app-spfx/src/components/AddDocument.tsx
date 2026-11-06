import * as React from 'react';
import type { ProjectInfo, DocTypeInfo } from '../domain/types';
import * as R from '../domain/rules';
import * as N from '../domain/numbering';
import { Register, RuleError, Me } from '../services/register';
import { Btn, Field, Notice, Select, input, row, C, MONO } from './ui';

export function AddDocument(props: { reg: Register; me: Me; projects: ProjectInfo[]; members: string[]; onDone: (id: number) => void; onCancel: () => void }) {
  const [project, setProject] = React.useState(props.projects[0]?.code || '');
  const [types, setTypes] = React.useState<DocTypeInfo[]>([]);
  const [typeCode, setTypeCode] = React.useState('');
  const [existing, setExisting] = React.useState<string[]>([]);
  const [f, setF] = React.useState({ title: '', owner: props.me.name, file: null as File | null, reason: '', summary: '', note: '', checker: '', approver: '', expiresOn: '', dueDay: '5', startPeriod: R.monthKey() });
  const [errors, setErrors] = React.useState<R.Errors>({});
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!project) { setTypes([]); return; }
    props.reg.projectTypes(project).then(t => { setTypes(t); setTypeCode(t[0]?.code || ''); }).catch(e => setMsg(String(e.message || e)));
    props.reg.allDocumentNumbers().then(setExisting).catch(() => setExisting([]));
  }, [project]);

  const proj = props.projects.find(p => p.code === project);
  const type = types.find(t => t.code === typeCode);
  const preview = proj && type ? N.nextNumber({ pattern: proj.numberPattern, project: proj.code, type: type.code, existing }) : '';

  const save = async () => {
    if (!proj || !type) { setErrors({ project: 'Choose a project and a document type.' }); return; }
    setBusy(true); setMsg(''); setErrors({});
    try {
      const id = await props.reg.createDocument({
        project: proj, type, title: f.title, owner: f.owner, file: f.file, reason: f.reason, summary: f.summary, note: f.note,
        checker: f.checker, approver: f.approver, expiresOn: f.expiresOn, dueDay: Number(f.dueDay), startPeriod: f.startPeriod,
      });
      props.onDone(id);
    } catch (e) {
      if (e instanceof RuleError) setErrors(e.fields); setMsg(String((e as Error).message));
    } finally { setBusy(false); }
  };

  const people = (sel: string, set: (v: string) => void, label: string) =>
    <Select label={label} value={sel} onChange={set} options={props.members.map(m => [m, m])} />;

  return (
    <div>
      <Btn kind="link" onClick={props.onCancel}>← Back</Btn>
      <h1>Add a document</h1>
      {msg ? <Notice tone="bad">{msg}</Notice> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Project" error={errors.project}>
          <Select label="Project" value={project} onChange={setProject} placeholder="Choose…" options={props.projects.map(p => [p.code, p.name])} />
        </Field>
        <Field label="Document type" error={errors.type}>
          <Select label="Document type" value={typeCode} onChange={setTypeCode} placeholder="Choose…" options={types.map(t => [t.code, `${t.code} · ${t.label}`])} />
        </Field>
      </div>
      {type ? <Notice tone="info"><b>{type.kind === 'controlled' ? 'Controlled' : type.kind === 'periodic' ? 'Recurring' : 'Certificate'}.</b>{' '}
        {type.kind === 'controlled' ? 'Upload, check and approve. Revisions.' : type.kind === 'periodic' ? 'Set up a monthly series. Each month is uploaded. No approval.' : 'Upload with an expiry date. Renew before expiry.'}
        <br />Number: <b style={{ fontFamily: MONO }}>{preview}</b> (filled in automatically) · Folder: {type.folder.split('/').join(' › ')}</Notice> : null}
      <Field label="Title" error={errors.title}><input aria-label="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={input} /></Field>
      <Field label="Owner" error={errors.owner}>{people(f.owner, v => setF({ ...f, owner: v }), 'Owner')}</Field>

      {type && type.kind === 'periodic' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Due day each month (1 to 28)" error={errors.dueDay}><input aria-label="Due day" type="number" min={1} max={28} value={f.dueDay} onChange={e => setF({ ...f, dueDay: e.target.value })} style={input} /></Field>
          <Field label="First month" error={errors.startPeriod}><input aria-label="First month" type="month" value={f.startPeriod} onChange={e => setF({ ...f, startPeriod: e.target.value })} style={input} /></Field>
        </div>
      ) : type ? (
        <>
          <Field label="File" error={errors.file} help="PDF, Word, Excel, DWG or ZIP. Up to 50 MB."><input type="file" aria-label="File" onChange={e => setF({ ...f, file: e.target.files?.[0] || null })} /></Field>
          <Field label="One-line summary" error={errors.summary} help="What changed, and why."><input aria-label="Summary" value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} style={input} /></Field>
          {type.kind === 'record' ? (
            <Field label="Expiry date" error={errors.expiresOn}><input aria-label="Expiry date" type="date" value={f.expiresOn} onChange={e => setF({ ...f, expiresOn: e.target.value })} style={{ ...input, maxWidth: 220 }} /></Field>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Reason" error={errors.reason}><Select label="Reason" value={f.reason} onChange={v => setF({ ...f, reason: v })} options={R.REASONS.map(x => [x, x])} /></Field>
                <Field label="Checker" error={errors.checker}>{people(f.checker, v => setF({ ...f, checker: v }), 'Checker')}</Field>
              </div>
              <Field label="Approver" error={errors.approver} help="Must be a different person from the checker.">{people(f.approver, v => setF({ ...f, approver: v }), 'Approver')}</Field>
              <Field label="Note for the checker" error={errors.note}><textarea aria-label="Note for the checker" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} style={{ ...input, minHeight: 60 }} /></Field>
            </>
          )}
        </>
      ) : null}
      <div style={row}>
        <Btn kind="primary" disabled={busy || !type} onClick={save}>{type && type.kind === 'periodic' ? 'Set up series' : 'Save'}</Btn>
        <Btn kind="link" onClick={props.onCancel}>Cancel</Btn>
        <span style={{ fontSize: 13, color: C.soft }}>{busy ? 'Saving…' : ''}</span>
      </div>
    </div>
  );
}
