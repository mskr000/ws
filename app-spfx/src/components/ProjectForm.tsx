import * as P from '../domain/permissions';
import type { Me } from '../services/register';
import * as React from 'react';
import * as SU from '../domain/setup';
import * as N from '../domain/numbering';
import { Register, RuleError } from '../services/register';
import { Btn, Notice, Field, Select, input, row, card, C, MONO } from './ui';

interface Before { setup: SU.ProjectSetup; locked: boolean; docsInFolder: Record<string, number>; docsOfType: Record<string, number> }

const blankSetup = (): SU.ProjectSetup => {
  const std = SU.BUILT_IN_TEMPLATES[0];
  return { code: '', name: '', status: 'active', numberPattern: N.DEFAULT_PATTERN, folders: std.folders.slice(),
    types: SU.DOC_TYPES.map(t => ({ code: t.code, enabled: std.types.some(x => x.code === t.code), folder: t.folder, firstNumber: 1 })) };
};

export function ProjectForm(props: { reg: Register; me: Me; code: string | null; onDone: () => void; onCancel: () => void }) {
  const isNew = props.code === null;
  const canEdit = P.can(props.me, 'projects', props.code || P.ALL_PROJECTS);
  const ro = !canEdit;
  const [pf, setPf] = React.useState<SU.ProjectSetup | null>(isNew ? blankSetup() : null);
  const [before, setBefore] = React.useState<Before | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ tone: 'bad' | 'ok' | 'info'; text: string } | null>(null);
  const [templates, setTemplates] = React.useState<SU.TemplateDef[]>(SU.BUILT_IN_TEMPLATES);
  const [tplId, setTplId] = React.useState('');
  const [newFolder, setNewFolder] = React.useState('');
  const [csvMsg, setCsvMsg] = React.useState<{ tone: 'bad' | 'ok'; lines: string[] } | null>(null);
  const [saveName, setSaveName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    props.reg.templates().then(setTemplates).catch(() => undefined);
    if (!isNew && props.code) {
      props.reg.projectSetup(props.code).then(r => {
        setPf(r.setup);
        setBefore({ setup: r.setup, locked: r.locked, docsInFolder: r.docsInFolder, docsOfType: r.docsOfType });
      }).catch(e => setMsg({ tone: 'bad', text: String(e.message || e) }));
    }
  }, [props.code]);

  if (!pf) return <div>{msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : 'Loading…'}</div>;
  const locked = !!before?.locked;
  const set = (patch: Partial<SU.ProjectSetup>) => setPf({ ...pf, ...patch });
  const setType = (code: string, patch: Partial<SU.SetupType>) => set({ types: pf.types.map(t => t.code === code ? { ...t, ...patch } : t) });
  const typeRow = (code: string) => pf.types.find(t => t.code === code);

  const applyTemplate = (t: SU.TemplateDef) => {
    set({ numberPattern: t.numberPattern, folders: t.folders.slice(),
      types: SU.DOC_TYPES.map(d => { const use = t.types.find(x => x.code === d.code); return { code: d.code, enabled: !!use, folder: use ? use.folder : d.folder, firstNumber: use ? use.firstNumber : 1 }; }) });
    setMsg({ tone: 'info', text: `Loaded "${t.name}". Change anything you need below.` });
  };
  const addFolder = () => {
    const f = newFolder.trim();
    if (!f) return;
    const bad = SU.folderPathError(f);
    if (bad) { setErrors({ ...errors, [`folder:${f}`]: bad }); return; }
    if (pf.folders.includes(f)) { setErrors({ ...errors, [`folder:${f}`]: 'That folder already exists.' }); return; }
    set({ folders: [...pf.folders, f] }); setNewFolder(''); setErrors({});
  };
  const removeFolder = (f: string) => {
    if (before && (before.docsInFolder[f] || 0) > 0) { setErrors({ ...errors, [`folder:${f}`]: `${before.docsInFolder[f]} document(s) are filed here. Move them first.` }); return; }
    set({ folders: pf.folders.filter(x => x !== f), types: pf.types.map(t => t.folder === f ? { ...t, folder: pf.folders.find(x => x !== f) || '' } : t) });
  };
  const loadCsv = async (file: File | null) => {
    if (!file) return;
    const r = props.reg.previewFolderCsv(await file.text());
    if (r.errors.length) { setCsvMsg({ tone: 'bad', lines: r.errors.map(e => e.line ? `Line ${e.line}: ${e.message}` : e.message) }); return; }
    setCsvMsg({ tone: 'ok', lines: [`Loaded ${r.folders.length} folders and ${r.types.length} document types${r.usedDefaults ? ' (types matched to folders by standard filing)' : ''}.`] });
    set({ folders: r.folders, types: SU.DOC_TYPES.map(d => { const use = r.types.find(x => x.code === d.code); return { code: d.code, enabled: !!use, folder: use ? use.folder : (r.folders.includes(d.folder) ? d.folder : (r.folders[0] || '')), firstNumber: 1 }; }) });
  };

  const save = async () => {
    setBusy(true); setErrors({}); setMsg(null);
    try {
      if (isNew) { const code = await props.reg.createProject({ ...pf, code: pf.code.trim().toUpperCase() }); setMsg({ tone: 'ok', text: `${code} created.` }); props.onDone(); }
      else { const n = await props.reg.updateProject(pf, before!); setMsg({ tone: 'ok', text: n ? 'Saved.' : 'No changes.' }); props.onDone(); }
    } catch (e) {
      if (e instanceof RuleError) { setErrors(e.fields); setMsg({ tone: 'bad', text: e.message }); }
      else setMsg({ tone: 'bad', text: String((e as Error).message || e) });
    } finally { setBusy(false); }
  };
  const saveTemplate = async () => {
    setMsg(null);
    try { await props.reg.saveTemplate(saveName, `Saved from ${pf.code}`, pf); setMsg({ tone: 'ok', text: 'Template saved.' }); setSaveName(''); }
    catch (e) { if (e instanceof RuleError) { setErrors(e.fields); setMsg({ tone: 'bad', text: e.message }); } else setMsg({ tone: 'bad', text: String((e as Error).message || e) }); }
  };
  const err = (k: string) => errors[k] ? <div style={{ fontSize: 13, color: C.bad }} role="alert">{errors[k]}</div> : null;
  const patternProblem = SU.projectSetupErrors({ ...pf, folders: [], types: [] }, false, []).numberPattern;
  const example = patternProblem ? 'needs one {SEQ} token' : N.formatNumber(pf.numberPattern, { project: pf.code || 'U100', type: 'PID', seq: 457, year: new Date().getUTCFullYear() });

  return (
    <div>
      <Btn kind="link" onClick={props.onCancel}>← Projects</Btn>
      <h1>{isNew ? 'Add a project' : `${pf.code} · project setup`}</h1>
      <p style={{ color: C.soft, margin: '0 0 12px' }}>Work through the sections, then press Save.{locked ? ' Documents exist: the code, numbering and folders with documents are locked.' : ''}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {Object.keys(errors).length && !msg ? <Notice tone="bad">Please fix the highlighted fields.</Notice> : null}

      {isNew ? (
        <section style={card}>
          <h2>0. Start from a template</h2>
          <div style={row}>
            <Select label="Template" value={tplId} onChange={setTplId} placeholder="Blank: standard structure" options={templates.map(t => [t.id, `${t.name}${t.builtIn ? '' : ' (saved)'}`])} />
            <Btn disabled={ro} onClick={() => { const t = templates.find(x => x.id === tplId); if (t) applyTemplate(t); else set({ ...blankSetup(), code: pf.code, name: pf.name }); }}>Load template</Btn>
          </div>
          <div style={{ fontSize: 12.5, color: C.soft, marginTop: 6 }}>{templates.find(t => t.id === tplId)?.description || 'Loading a template fills in folders, numbering and document types. You can still change them.'}</div>
        </section>
      ) : null}

      <section style={card}>
        <h2>1. Basics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Project code" error={errors.code} help="2 to 5 capital letters or digits. Used at the start of every document number. Cannot change once documents exist.">
            <input aria-label="Project code" value={pf.code} disabled={!isNew || ro} onChange={e => set({ code: e.target.value.toUpperCase() })} style={input} />
          </Field>
          <Field label="Project name" error={errors.name}>
            <input aria-label="Project name" value={pf.name} disabled={ro} onChange={e => set({ name: e.target.value })} style={input} />
          </Field>
        </div>
        {!isNew ? <Field label="Status"><Select label="Status" value={pf.status} onChange={v => set({ status: v as 'active' | 'archived' })} placeholder="" options={[['active', 'Active'], ['archived', 'Archived (no new documents)']]} disabled={ro} /></Field> : null}
      </section>

      <section style={card}>
        <h2>2. Numbering</h2>
        <Field label="Numbering pattern" error={errors.numberPattern} help="Tokens: {PROJ} project code · {TYPE} document type · {SEQ:4} running number, 4 digits (required, once) · {YYYY} year. Other characters: letters, digits, - . _ /">
          <input aria-label="Numbering pattern" value={pf.numberPattern} disabled={ro || locked} onChange={e => set({ numberPattern: e.target.value })} style={{ ...input, fontFamily: MONO }} />
        </Field>
        <div style={{ fontSize: 13 }}>Example: <b style={{ fontFamily: MONO }}>{example}</b>{locked ? ' · locked: documents exist' : ''}</div>
      </section>

      <section style={card}>
        <h2>3. Folders</h2>
        <div style={{ ...row, marginBottom: 8 }}>
          <input aria-label="Upload folder CSV" type="file" accept=".csv,text/csv" disabled={ro} onChange={e => loadCsv(e.target.files?.[0] || null)} />
          <span style={{ fontSize: 12.5, color: C.soft }}>CSV columns: folder, types (optional, separated by ;)</span>
        </div>
        {csvMsg ? <Notice tone={csvMsg.tone === 'ok' ? 'ok' : 'bad'}>{csvMsg.lines.map((l, i) => <div key={i}>{l}</div>)}{csvMsg.tone === 'bad' ? <div>Nothing was changed.</div> : null}</Notice> : null}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, maxHeight: 260, overflow: 'auto' }}>
          {pf.folders.length === 0 ? <div style={{ padding: 10, color: C.soft }}>No folders yet.</div> : null}
          {pf.folders.map(f => (
            <div key={f} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px', gap: 8, padding: '6px 10px', borderBottom: `1px solid ${C.line}`, fontSize: 13, alignItems: 'center' }}>
              <span>{f.split('/').join(' › ')}</span>
              <span style={{ color: C.soft }}>{before && (before.docsInFolder[f] || 0) > 0 ? `${before.docsInFolder[f]} doc(s)` : ''}</span>
              <span><Btn kind="link" disabled={ro} onClick={() => removeFolder(f)}>Remove</Btn></span>
              {err(`folder:${f}`) ? <span style={{ gridColumn: '1 / -1' }}>{err(`folder:${f}`)}</span> : null}
            </div>
          ))}
        </div>
        <div style={{ ...row, marginTop: 8 }}>
          <input aria-label="New folder path" placeholder="New folder, for example EPC/07 Close-out/07.1 Records" value={newFolder} disabled={ro} onChange={e => setNewFolder(e.target.value)} style={{ ...input, flex: 1 }} />
          <Btn disabled={ro} onClick={addFolder}>Add folder</Btn>
        </div>
        <div style={{ fontSize: 12.5, color: C.soft }}>Up to 4 levels, separated by /. A folder with documents cannot be removed.</div>
      </section>

      <section style={card}>
        <h2>4. Document types</h2>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, maxHeight: 320, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['On', 'Type', 'Kind', 'Files into', 'First number'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, fontSize: 11, textTransform: 'uppercase', color: C.soft, borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {SU.DOC_TYPES.map(d => {
                const t = typeRow(d.code)!;
                const inUse = (before?.docsOfType[d.code] || 0) > 0;
                return (
                  <tr key={d.code} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <td style={{ padding: 8 }}><input type="checkbox" aria-label={`Turn on ${d.code}`} checked={t.enabled} disabled={ro || (inUse && t.enabled)} onChange={e => setType(d.code, { enabled: e.target.checked })} /></td>
                    <td style={{ padding: 8 }}><span style={{ fontFamily: MONO }}>{d.code}</span> {d.label}{inUse ? <span style={{ color: C.soft }}> · in use</span> : null}{err(`type:${d.code}`)}</td>
                    <td style={{ padding: 8 }}>{d.kind}</td>
                    <td style={{ padding: 8 }}><select aria-label={`Folder for ${d.code}`} value={t.folder} disabled={ro || !t.enabled} onChange={e => setType(d.code, { folder: e.target.value })} style={{ ...input, width: 'auto', minWidth: 200 }}>{pf.folders.map(f => <option key={f} value={f}>{f}</option>)}</select></td>
                    <td style={{ padding: 8 }}><input aria-label={`First number for ${d.code}`} type="number" min={1} max={9999} value={t.firstNumber} disabled={ro || inUse} onChange={e => setType(d.code, { firstNumber: Number(e.target.value) })} style={{ ...input, width: 90 }} />{err(`first:${d.code}`)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {err('types')}
      </section>

      {!isNew && canEdit ? (
        <section style={card}>
          <h2>Save this setup as a template</h2>
          <div style={row}>
            <input aria-label="Template name" placeholder="Template name" value={saveName} onChange={e => setSaveName(e.target.value)} style={{ ...input, maxWidth: 300 }} />
            <Btn onClick={saveTemplate}>Save as template</Btn>
          </div>
        </section>
      ) : null}

      <div style={{ ...row, justifyContent: 'flex-end' }}>
        <Btn kind="link" onClick={props.onCancel}>Cancel</Btn>
        {!ro ? <Btn kind="primary" disabled={busy} onClick={save}>{isNew ? 'Create project' : 'Save changes'}</Btn> : null}
      </div>
    </div>
  );
}
