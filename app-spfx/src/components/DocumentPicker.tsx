import * as React from 'react';
import * as S from '../domain/selection';
import type { DocumentRow } from '../domain/types';
import { Register } from '../services/register';
import { Btn, Field, Notice, Select, input, row, card, C, MONO, hint, Section, Pill } from './ui';

const TONE: Record<S.FileStatus, 'ok' | 'wait' | 'bad' | 'none' | 'check'> = { current: 'ok', superseded: 'none', in_review: 'wait', returned: 'bad', removed: 'bad' };
const PAGE = 25;

/* Chooses files for a transmittal from a long register. One page at a time. Drafts are never offered. */
export function DocumentPicker(props: { reg: Register; project: string; folders: string[]; chosen: S.CandidateFile[]; setChosen: (f: S.CandidateFile[]) => void }) {
  const [mode, setMode] = React.useState<'search' | 'paste'>('search');
  const [folder, setFolder] = React.useState('');
  const [text, setText] = React.useState('');
  const [pasted, setPasted] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [docs, setDocs] = React.useState<DocumentRow[]>([]);
  const [more, setMore] = React.useState(false);
  const [files, setFiles] = React.useState<Record<number, S.CandidateFile[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [note, setNote] = React.useState('');

  const load = React.useCallback(async (p: number, numbers?: string[]) => {
    setLoading(true); setErr('');
    try {
      const r = await props.reg.findDocuments(props.project, { folder: folder || undefined, text: numbers ? undefined : text, numbers, skip: (p - 1) * PAGE, take: PAGE });
      const f = await props.reg.filesFor(r.docs);
      const byDoc: Record<number, S.CandidateFile[]> = {};
      f.forEach(x => { (byDoc[x.docId] = byDoc[x.docId] || []).push(x); });
      setDocs(r.docs); setMore(r.more); setFiles(byDoc); setPage(p);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }, [props.reg, props.project, folder, text]);

  const isChosen = (f: S.CandidateFile) => props.chosen.some(c => c.key === f.key);
  const toggle = (f: S.CandidateFile) => props.setChosen(isChosen(f) ? props.chosen.filter(c => c.key !== f.key) : [...props.chosen, f]);
  const addCurrent = (list: S.CandidateFile[]) => {
    const cur = S.defaultChoice(list).filter(f => !isChosen(f));
    if (!cur.length) { setNote('No current version to add for this document.'); return; }
    const over = S.overLimit(props.chosen.length + cur.length);
    if (over) { setErr(over); return; }
    props.setChosen([...props.chosen, ...cur]);
  };
  const pasteNumbers = () => {
    const nums = S.parseNumbers(pasted);
    if (!nums.length) { setErr('Paste at least one document number.'); return; }
    if (nums.length > 100) { setErr('Paste up to 100 numbers at a time.'); return; }
    load(1, nums);
  };
  const needsAck = props.chosen.some(S.needsConfirm);
  const over = S.overLimit(props.chosen.length);

  return (
    <Section title="Files to send">
      {err ? <Notice tone="bad">{err}</Notice> : null}
      {note ? <Notice tone="info">{note}</Notice> : null}
      <div style={card}>
        <div style={{ ...row, alignItems: 'flex-end' }}>
          <Btn kind={mode === 'search' ? 'primary' : 'plain'} onClick={() => setMode('search')}>Search and browse</Btn>
          <Btn kind={mode === 'paste' ? 'primary' : 'plain'} onClick={() => setMode('paste')}>Paste document numbers</Btn>
        </div>
        {mode === 'search' ? (
          <div style={{ ...row, alignItems: 'flex-end', marginTop: 14 }}>
            <Select label="Folder" value={folder} onChange={v => { setFolder(v); }} options={[['', 'Whole project'], ...props.folders.map(f => [f, f] as [string, string])]} width={320} />
            <div style={{ flex: '1 1 240px' }}><Field label="Number or title contains"><input aria-label="Search documents" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. PID or pump" style={input} /></Field></div>
            <Btn kind="primary" disabled={loading} onClick={() => load(1)}>{loading ? 'Searching…' : 'Search'}</Btn>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <Field label="Document numbers" help="Separate with spaces, commas or new lines. Up to 100."><textarea aria-label="Document numbers" value={pasted} onChange={e => setPasted(e.target.value)} style={{ ...input, minHeight: 90, fontFamily: MONO, fontSize: 13 }} /></Field>
            <Btn kind="primary" disabled={loading} onClick={pasteNumbers}>Find these</Btn>
          </div>
        )}
        <div style={{ ...hint, marginTop: 10 }}>Drafts are never offered here. Only stored revisions, uploads and certificates.</div>
      </div>

      {docs.length ? (
        <div style={card}>
          {docs.map(d => {
            const list = files[d.id] || [];
            const cur = S.defaultChoice(list);
            return (
              <div key={d.id} style={{ borderTop: `1px solid ${C.line}`, padding: '12px 0' }}>
                <div style={{ ...row, justifyContent: 'space-between' }}>
                  <div><span style={{ fontFamily: MONO, fontSize: 13 }}>{d.number}</span> <span style={{ fontWeight: 500 }}>{d.title}</span> <span style={{ color: C.soft, fontSize: 13 }}>· {d.folder}</span></div>
                  <Btn kind="link" disabled={!cur.length} onClick={() => addCurrent(list)}>Add current version</Btn>
                </div>
                {list.length === 0 ? <div style={{ ...hint, marginTop: 6 }}>No file stored yet.</div> : list.map(f => (
                  <label key={f.key} style={{ ...row, flexWrap: 'nowrap', padding: '6px 0 0 4px', cursor: 'pointer' }}>
                    <input type="checkbox" aria-label={`Add ${f.fileName}`} checked={isChosen(f)} onChange={() => toggle(f)} />
                    <span style={{ fontSize: 14, minWidth: 90 }}>{f.version}</span>
                    <span style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fileName}</span>
                    <Pill tone={TONE[f.status]}>{S.STATUS_WORDS[f.status]}</Pill>
                  </label>
                ))}
              </div>
            );
          })}
          {loading ? null : <div style={{ ...row, justifyContent: 'space-between', marginTop: 8 }}>
            <Btn kind="link" disabled={page <= 1} onClick={() => load(page - 1)}>← Previous</Btn>
            <span style={{ fontSize: 13, color: C.soft }}>Page {page}</span>
            <Btn kind="link" disabled={!more} onClick={() => load(page + 1)}>Next →</Btn>
          </div>}
        </div>
      ) : null}

      <div style={{ ...card, borderLeft: `4px solid ${over ? C.bad : C.accent}` }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          {props.chosen.length === 0 ? 'No files chosen yet' : `${props.chosen.length} file${props.chosen.length === 1 ? '' : 's'} chosen`}
          <span style={{ fontWeight: 400, color: C.soft, fontSize: 13 }}> · limit {S.MAX_LINES} per transmittal</span>
        </div>
        {props.chosen.map(f => (
          <div key={f.key} style={{ ...row, flexWrap: 'nowrap', padding: '6px 0', borderTop: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: MONO, fontSize: 13, minWidth: 150 }}>{f.number}</span>
            <span style={{ fontSize: 14, minWidth: 90 }}>{f.version}</span>
            <span style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fileName}</span>
            <Pill tone={TONE[f.status]}>{S.STATUS_WORDS[f.status]}</Pill>
            <Btn kind="link" label={`Take ${f.fileName} off`} onClick={() => props.setChosen(props.chosen.filter(c => c.key !== f.key))}>Remove</Btn>
          </div>
        ))}
        {over ? <Notice tone="bad">{over}</Notice> : null}
        {needsAck ? <Notice tone="warn">Some chosen files are not the current version. Check each one above. Confirm before sending.</Notice> : null}
      </div>
    </Section>
  );
}
