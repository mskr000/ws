import * as React from 'react';
import * as S from '../domain/selection';
import * as TREE from '../domain/tree';
import type { DocumentRow } from '../domain/types';
import { Register } from '../services/register';
import { Btn, Notice, input, row, card, C, MONO, hint, Pill } from './ui';

const TONE: Record<S.FileStatus, 'ok' | 'wait' | 'bad' | 'none' | 'check'> = { current: 'ok', superseded: 'none', in_review: 'wait', returned: 'bad', removed: 'bad' };
const PAGE = 25;
const CONTROL_H = 40; // every control in this row has this height

/* Chooses files for a transmittal. Browse by folder, or search, or paste numbers. One page at a time. Drafts are never offered. */
export function DocumentPicker(props: { reg: Register; project: string; folders: string[]; chosen: S.CandidateFile[]; setChosen: (f: S.CandidateFile[]) => void }) {
  const [mode, setMode] = React.useState<'browse' | 'paste'>('browse');
  const [folder, setFolder] = React.useState('');          // '' = whole project
  const [withSub, setWithSub] = React.useState(true);
  const [text, setText] = React.useState('');
  const [pasted, setPasted] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [docs, setDocs] = React.useState<DocumentRow[]>([]);
  const [more, setMore] = React.useState(false);
  const [files, setFiles] = React.useState<Record<number, S.CandidateFile[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const [opened, setOpened] = React.useState<Record<string, boolean>>({});
  const [bodyOpen, setBodyOpen] = React.useState(true);
  const [chosenOpen, setChosenOpen] = React.useState(true);
  const [docOpen, setDocOpen] = React.useState<Record<number, boolean>>({});
  const allPaths = (ns: TREE.FolderNode[]): string[] => ns.flatMap(n => [n.path, ...allPaths(n.children)]);
  const collapseAll = () => setOpened(Object.fromEntries(allPaths(TREE.folderTree(props.folders)).map(p => [p, false])));
  const expandAll = () => setOpened(Object.fromEntries(allPaths(TREE.folderTree(props.folders)).map(p => [p, true])));

  const load = React.useCallback(async (p: number, o?: { folder?: string; sub?: boolean; text?: string; numbers?: string[] }) => {
    const f = o?.folder ?? folder;
    const sub = o?.sub ?? withSub;
    setLoading(true); setErr(''); setShown(true);
    try {
      const r = await props.reg.findDocuments(props.project, {
        folder: f || undefined, subfolders: sub, text: o?.numbers ? undefined : (o?.text ?? text), numbers: o?.numbers, skip: (p - 1) * PAGE, take: PAGE,
      });
      const fl = await props.reg.filesFor(r.docs);
      const byDoc: Record<number, S.CandidateFile[]> = {};
      fl.forEach(x => { (byDoc[x.docId] = byDoc[x.docId] || []).push(x); });
      setDocs(r.docs); setMore(r.more); setFiles(byDoc); setPage(p);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }, [props.reg, props.project, folder, withSub, text]);

  const pickFolder = (path: string) => { setFolder(path); setOpened({}); load(1, { folder: path }); };
  const isChosen = (f: S.CandidateFile) => props.chosen.some(c => c.key === f.key);
  const toggle = (f: S.CandidateFile) => props.setChosen(isChosen(f) ? props.chosen.filter(c => c.key !== f.key) : [...props.chosen, f]);
  const [note, setNote] = React.useState('');
  const addCurrent = (list: S.CandidateFile[]) => {
    const cur = S.defaultChoice(list).filter(f => !isChosen(f));
    if (!cur.length) { setNote('No current version to add for this document.'); return; }
    const over = S.overLimit(props.chosen.length + cur.length);
    if (over) { setErr(over); return; }
    setNote(''); props.setChosen([...props.chosen, ...cur]);
  };
  const addFolderCurrent = () => {
    const all = docs.flatMap(d => S.defaultChoice(files[d.id] || []));
    const fresh = all.filter(f => !isChosen(f));
    const over = S.overLimit(props.chosen.length + fresh.length);
    if (over) { setErr(over); return; }
    props.setChosen([...props.chosen, ...fresh]);
  };
  const pasteNumbers = () => {
    const nums = S.parseNumbers(pasted);
    if (!nums.length) { setErr('Paste at least one document number.'); return; }
    if (nums.length > 100) { setErr('Paste up to 100 numbers at a time.'); return; }
    load(1, { numbers: nums });
  };
  const needsAck = props.chosen.some(S.needsConfirm);
  const over = S.overLimit(props.chosen.length);

  /* Folder tree, indented, with the selected folder highlighted. */
  const renderNode = (n: TREE.FolderNode): React.ReactNode => {
    const on = folder === n.path;
    const isOpen = opened[n.path] ?? (n.depth < 1);
    return (
      <div key={n.path}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: n.depth * 14 }}>
          <button type="button" aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${n.name}`} disabled={!n.children.length}
            onClick={() => setOpened(o => ({ ...o, [n.path]: !isOpen }))}
            style={{ width: 18, border: 'none', background: 'none', color: C.soft, cursor: n.children.length ? 'pointer' : 'default', fontSize: 11 }}>
            {n.children.length ? (isOpen ? '▾' : '▸') : ''}
          </button>
          <button type="button" aria-label={`Open folder ${n.path}`} aria-current={on ? 'true' : undefined} onClick={() => pickFolder(n.path)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', borderRadius: 8, padding: '6px 8px', fontSize: 13.5, cursor: 'pointer',
              background: on ? C.accentSoft : 'transparent', color: on ? C.accent : C.ink, fontWeight: on ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.name}
          </button>
        </div>
        {isOpen ? n.children.map(renderNode) : null}
      </div>
    );
  };

  return (
    <section style={{ marginTop: 32 }}>
      <button type="button" aria-expanded={bodyOpen} onClick={() => setBodyOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', background: 'none', padding: '4px 0 10px', cursor: 'pointer', color: C.ink }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Files to send</span>
        <span style={{ fontSize: 14, color: C.soft }}>{props.chosen.length} chosen · {bodyOpen ? 'Hide' : 'Show'} ▾</span>
      </button>
      {!bodyOpen ? null : <>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      {note ? <Notice tone="info">{note}</Notice> : null}

      <div style={{ ...row, marginBottom: 12 }}>
        <Btn kind={mode === 'browse' ? 'primary' : 'plain'} onClick={() => setMode('browse')}>Browse folders and search</Btn>
        <Btn kind={mode === 'paste' ? 'primary' : 'plain'} onClick={() => setMode('paste')}>Paste document numbers</Btn>
      </div>

      {mode === 'browse' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 12, alignItems: 'start' }}>
          <div style={{ ...card, padding: 10, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Folders</div>
            <button type="button" aria-label="Open whole project" aria-current={folder === '' ? 'true' : undefined} onClick={() => pickFolder('')}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: '6px 8px', fontSize: 13.5, cursor: 'pointer',
                background: folder === '' && shown ? C.accentSoft : 'transparent', color: folder === '' && shown ? C.accent : C.ink, fontWeight: folder === '' && shown ? 600 : 400 }}>
              Whole project
            </button>
            <div style={{ ...row, gap: 2, margin: '2px 0 6px' }}>
              <Btn kind="link" onClick={collapseAll}>Collapse all</Btn>
              <Btn kind="link" onClick={expandAll}>Expand all</Btn>
            </div>
            {TREE.folderTree(props.folders).map(renderNode)}
          </div>

          <div style={{ ...card, marginBottom: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', height: CONTROL_H }}>
              <input aria-label="Search documents" value={text} onChange={e => setText(e.target.value)} placeholder="Number or title contains…"
                onKeyDown={e => { if (e.key === 'Enter') load(1, { text }); }}
                style={{ ...input, height: CONTROL_H, boxSizing: 'border-box', padding: '0 12px', flex: 1, minWidth: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', height: CONTROL_H }}>
                <Btn kind="primary" disabled={loading} style={{ height: CONTROL_H, padding: '0 18px' }} onClick={() => load(1, { text })}>{loading ? 'Searching…' : 'Search'}</Btn>
              </div>
            </div>
            <label style={{ ...row, fontSize: 13, color: C.soft, marginTop: 8 }}>
              <input type="checkbox" checked={withSub} onChange={e => { setWithSub(e.target.checked); if (shown) load(1, { sub: e.target.checked }); }} />
              Include subfolders
            </label>
            <div style={{ ...hint, marginTop: 6 }}>
              {folder ? <>Showing <span style={{ fontFamily: MONO }}>{folder}</span>{withSub ? ' and its subfolders' : ' only'}.</> : 'Showing the whole project. Pick a folder on the left to narrow it down.'}
              {' '}Search looks at numbers and titles.
            </div>

            {!shown ? <div style={{ ...hint, marginTop: 16 }}>Pick a folder, or search, to see its files.</div> : null}
            {shown && !loading && docs.length === 0 ? <div style={{ ...hint, marginTop: 16 }}>No documents found here.</div> : null}

            {docs.length ? (
              <>
                <div style={{ ...row, justifyContent: 'space-between', marginTop: 12, position: 'sticky', top: 0, background: C.panel, padding: '6px 0', zIndex: 1 }}>
                  <span style={{ fontSize: 13, color: C.soft }}>Page {page} · {docs.length} documents</span>
                  <span style={{ ...row, gap: 4 }}>
                    <Btn kind="link" onClick={() => setDocOpen(Object.fromEntries(docs.map(d => [d.id, false])))}>Collapse all</Btn>
                    <Btn kind="link" onClick={() => setDocOpen(Object.fromEntries(docs.map(d => [d.id, true])))}>Expand all</Btn>
                    <Btn kind="link" onClick={addFolderCurrent}>Add current versions on this page</Btn>
                  </span>
                </div>
                <div style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
                {docs.map(d => {
                  const list = files[d.id] || [];
                  const cur = S.defaultChoice(list);
                  const isOpen = !!docOpen[d.id];
                  const curLabel = cur.length ? cur.map(c => c.version).join(', ') : 'no current version';
                  return (
                    <div key={d.id} style={{ borderTop: `1px solid ${C.line}`, padding: '8px 0' }}>
                      <div style={{ ...row, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                        <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${d.number}`} onClick={() => setDocOpen(o => ({ ...o, [d.id]: !isOpen }))}
                          style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: '4px 0', cursor: 'pointer', color: C.ink }}>
                          <span style={{ color: C.soft, marginRight: 6 }}>{isOpen ? '▾' : '▸'}</span>
                          <span style={{ fontFamily: MONO, fontSize: 13 }}>{d.number}</span> <span style={{ fontWeight: 500 }}>{d.title}</span>
                          <span style={{ display: 'block', fontSize: 12, color: C.soft, marginLeft: 16 }}>{d.folder} · {list.length} file{list.length === 1 ? '' : 's'} · current: {curLabel}</span>
                        </button>
                        <Btn kind="link" disabled={!cur.length} onClick={() => addCurrent(list)}>Add current</Btn>
                      </div>
                      {!isOpen ? null : list.length === 0 ? <div style={{ ...hint, marginTop: 4 }}>No file stored yet.</div> : list.map(f => (
                        <label key={f.key} style={{ ...row, flexWrap: 'nowrap', padding: '6px 0 0 4px', cursor: 'pointer' }}>
                          <input type="checkbox" aria-label={`Add ${f.fileName}`} checked={isChosen(f)} onChange={() => toggle(f)} />
                          <span style={{ fontSize: 14, minWidth: 96 }}>{f.version}</span>
                          <span style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fileName}</span>
                          <Pill tone={TONE[f.status]}>{S.STATUS_WORDS[f.status]}</Pill>
                        </label>
                      ))}
                    </div>
                  );
                })}
                </div>
                <div style={{ ...row, justifyContent: 'space-between', marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  <Btn kind="link" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>← Previous</Btn>
                  <span style={{ fontSize: 13, color: C.soft }}>Page {page}</span>
                  <Btn kind="link" disabled={!more || loading} onClick={() => load(page + 1)}>Next →</Btn>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={card}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Document numbers</label>
          <textarea aria-label="Document numbers" value={pasted} onChange={e => setPasted(e.target.value)} style={{ ...input, minHeight: 90, fontFamily: MONO, fontSize: 13 }} />
          <div style={{ ...hint, margin: '6px 0 10px' }}>Separate with spaces, commas or new lines. Up to 100.</div>
          <Btn kind="primary" disabled={loading} onClick={pasteNumbers}>Find these</Btn>
          {docs.length ? docs.map(d => (
            <div key={d.id} style={{ borderTop: `1px solid ${C.line}`, padding: '10px 0', marginTop: 10 }}>
              <div style={{ ...row, justifyContent: 'space-between' }}><span><span style={{ fontFamily: MONO, fontSize: 13 }}>{d.number}</span> {d.title}</span><Btn kind="link" onClick={() => addCurrent(files[d.id] || [])}>Add current version</Btn></div>
              {(files[d.id] || []).map(f => (
                <label key={f.key} style={{ ...row, flexWrap: 'nowrap', padding: '6px 0 0 4px' }}>
                  <input type="checkbox" aria-label={`Add ${f.fileName}`} checked={isChosen(f)} onChange={() => toggle(f)} />
                  <span style={{ fontSize: 14, minWidth: 96 }}>{f.version}</span>
                  <span style={{ fontSize: 14, flex: 1 }}>{f.fileName}</span>
                  <Pill tone={TONE[f.status]}>{S.STATUS_WORDS[f.status]}</Pill>
                </label>
              ))}
            </div>
          )) : null}
        </div>
      )}

      <div style={{ ...card, borderLeft: `4px solid ${over ? C.bad : C.accent}`, marginTop: 14 }}>
        <button type="button" aria-expanded={chosenOpen} onClick={() => setChosenOpen(o => !o)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.ink, fontWeight: 600, marginBottom: chosenOpen ? 8 : 0 }}>
          <span>{props.chosen.length === 0 ? 'No files chosen yet' : `${props.chosen.length} file${props.chosen.length === 1 ? '' : 's'} chosen`}
            <span style={{ fontWeight: 400, color: C.soft, fontSize: 13 }}> · limit {S.MAX_LINES} per transmittal</span></span>
          <span style={{ fontSize: 13, color: C.soft, fontWeight: 400 }}>{chosenOpen ? 'Collapse ▴' : 'Expand ▾'}</span>
        </button>
        {chosenOpen ? <div style={{ maxHeight: 260, overflowY: 'auto' }}>{props.chosen.map(f => (
          <div key={f.key} style={{ ...row, flexWrap: 'nowrap', padding: '6px 0', borderTop: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: MONO, fontSize: 13, minWidth: 150 }}>{f.number}</span>
            <span style={{ fontSize: 14, minWidth: 96 }}>{f.version}</span>
            <span style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fileName}</span>
            <Pill tone={TONE[f.status]}>{S.STATUS_WORDS[f.status]}</Pill>
            <Btn kind="link" label={`Take ${f.fileName} off`} onClick={() => props.setChosen(props.chosen.filter(c => c.key !== f.key))}>Remove</Btn>
          </div>
        ))}</div> : null}
        {over ? <Notice tone="bad">{over}</Notice> : null}
        {needsAck ? <Notice tone="warn">Some chosen files are not the current version. Check each one above. Confirm before sending.</Notice> : null}
      </div>
      </>}
    </section>
  );
}
