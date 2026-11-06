import * as React from 'react';
import type { DocumentRow, RevisionRow, PeriodRow, CertRow, AuditRow } from '../domain/types';
import * as R from '../domain/rules';
import { Register, RuleError, Me } from '../services/register';
import * as P from '../domain/permissions';
import { Btn, Pill, Field, Notice, Select, input, row, card, C, MONO } from './ui';

const KIND: Record<string, string> = { controlled: 'Controlled', periodic: 'Recurring', record: 'Certificate' };
const REV_TONE: Record<string, 'ok' | 'wait' | 'bad' | 'check' | 'none'> = { Submitted: 'wait', Checked: 'check', Approved: 'ok', Returned: 'bad' };
const REV_LABEL: Record<string, string> = { Submitted: 'Waiting for check', Checked: 'Waiting for approval', Approved: 'Approved', Returned: 'Sent back' };
const PERIOD_LABEL: Record<string, [string, 'ok' | 'wait' | 'bad' | 'check' | 'old' | 'none']> = {
  on_time: ['On time', 'ok'], late: ['Late', 'wait'], missing: ['Missing', 'bad'], open: ['Open', 'check'], not_needed: ['Not needed', 'old'], upcoming: ['', 'none'] };

interface Loaded { doc: DocumentRow; revs: RevisionRow[]; periods: PeriodRow[]; certs: CertRow[]; audit: AuditRow[] }

export function DocumentPage(props: { reg: Register; id: number; me: Me; members: string[]; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = React.useState<Loaded | null>(null);
  const [msg, setMsg] = React.useState<{ tone: 'bad' | 'ok' | 'info'; text: string } | null>(null);
  const [fieldErr, setFieldErr] = React.useState<R.Errors>({});
  const [sendBack, setSendBack] = React.useState<Record<number, string>>({});
  const [revOpen, setRevOpen] = React.useState(false);
  const [rv, setRv] = React.useState({ file: null as File | null, reason: '', summary: '', note: '', checker: '', approver: '' });
  const [period, setPeriod] = React.useState<{ key: string; mode: 'upload' | 'na' } | null>(null);
  const [pv, setPv] = React.useState({ file: null as File | null, summary: '', replaceReason: '', naReason: '' });
  const [renewOpen, setRenewOpen] = React.useState(false);
  const [renew, setRenew] = React.useState({ file: null as File | null, summary: '', expiresOn: '' });
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [remove, setRemove] = React.useState({ reason: '', text: '' });

  const load = React.useCallback(async () => {
    const docs = await props.reg.documents();
    const doc = docs.find(d => d.id === props.id);
    if (!doc) { setMsg({ tone: 'bad', text: 'This document was not found.' }); return; }
    const [revs, periods, certs, audit] = await Promise.all([
      doc.kind === 'controlled' ? props.reg.revisions(doc.id) : Promise.resolve([] as RevisionRow[]),
      doc.kind === 'periodic' ? props.reg.periods(doc.id) : Promise.resolve([] as PeriodRow[]),
      doc.kind === 'record' ? props.reg.certificates(doc.id) : Promise.resolve([] as CertRow[]),
      props.reg.audit(doc.id, 30),
    ]);
    setData({ doc, revs, periods, certs, audit });
  }, [props.reg, props.id]);

  React.useEffect(() => { load().catch(e => setMsg({ tone: 'bad', text: String(e.message || e) })); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setFieldErr({}); setMsg(null);
    try { await fn(); setMsg({ tone: 'ok', text: ok }); await load(); props.onChanged(); }
    catch (e) {
      if (e instanceof RuleError) { setFieldErr(e.fields); setMsg({ tone: 'bad', text: e.message }); }
      else setMsg({ tone: 'bad', text: String((e as Error).message || e) });
    }
  };

  if (!data) return <div>{msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : 'Loading…'}</div>;
  const { doc, revs, periods, certs, audit } = data;
  const cur = revs.filter(r => r.status === 'Approved').slice(-1)[0];
  const last = revs.length ? revs[revs.length - 1] : undefined;
  const isOwner = props.me.name === doc.owner;
  const canUpload = isOwner || P.can(props.me, 'edit_any', doc.project, doc.folder);
  const canRemove = P.can(props.me, 'remove', doc.project, doc.folder);

  const revisionBlock = (r: RevisionRow) => {
    const mine = props.me.name;
    const canCheckIt = r.status === 'Submitted' && mine === r.checker;
    const canApproveIt = r.status === 'Checked' && mine === r.approver;
    const canReturnIt = (r.status === 'Submitted' || r.status === 'Checked') && (mine === r.checker || mine === r.approver);
    return (
      <div key={r.id} style={{ borderLeft: `2px solid ${C.line}`, paddingLeft: 12, marginLeft: 4, paddingBottom: 14 }}>
        <div style={row}><b>Rev {r.n}</b><Pill tone={REV_TONE[r.status] || 'none'}>{REV_LABEL[r.status] || r.status}</Pill>{cur && cur.n === r.n ? <Pill tone="ok">Current</Pill> : null}</div>
        <div style={{ fontSize: 13, color: C.soft }}>{r.createdAt.slice(0, 10)} · added by {r.uploader} · {r.reason} · checker {r.checker} · approver {r.approver}</div>
        <div style={{ margin: '6px 0', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px' }}>{r.summary}</div>
        {r.returnNote ? <Notice tone="warn">Sent back: {r.returnNote}</Notice> : null}
        {r.fileUrl ? <div style={{ fontSize: 13 }}><a href={r.fileUrl} target="_blank" rel="noopener noreferrer">Open {r.fileName}</a></div> : null}
        <div style={{ fontSize: 12, color: C.soft, fontFamily: MONO, wordBreak: 'break-all' }}>SHA-256 {r.checksum || 'not recorded'}</div>
        <div style={{ ...row, marginTop: 8 }}>
          {canCheckIt ? <Btn kind="ok" onClick={() => run(() => props.reg.check(r, doc), 'Checked. Waiting for the approver.')}>Check</Btn> : null}
          {canApproveIt ? <Btn kind="ok" onClick={() => run(() => props.reg.approve(r, doc), 'Approved. It is now the current version.')}>Approve</Btn> : null}
          {canReturnIt ? <>
            <input aria-label={`Reason for sending back rev ${r.n}`} placeholder="Why? (10+ characters)" value={sendBack[r.id] || ''} onChange={e => setSendBack({ ...sendBack, [r.id]: e.target.value })} style={{ ...input, maxWidth: 320 }} />
            <Btn kind="danger" onClick={() => run(() => props.reg.sendBack(r, doc, sendBack[r.id] || ''), 'Sent back with your note.')}>Send back</Btn>
          </> : null}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Btn kind="link" onClick={props.onBack}>← All documents</Btn>
      <h1>{doc.title}</h1>
      <div style={{ fontSize: 13, color: C.soft, marginBottom: 14 }}>
        <span style={{ fontFamily: MONO }}>{doc.number}</span> · {KIND[doc.kind]} · {doc.folder.split('/').join(' › ')} · Owner {doc.owner}
        {doc.removed ? <> · <Pill tone="bad">Removed</Pill></> : null}
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {doc.kind === 'controlled' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <section style={card}><div style={{ fontSize: 13, color: C.soft }}>Current version</div>
              {cur ? <><div style={{ fontWeight: 650, fontSize: 18 }}>Rev {cur.n}</div><div>{cur.summary}</div></> : <div style={{ color: C.soft }}>No approved version yet.</div>}</section>
            <section style={card}><div style={{ fontSize: 13, color: C.soft }}>Latest version</div>
              {last ? <><div style={{ fontWeight: 650, fontSize: 18 }}>Rev {last.n} <Pill tone={REV_TONE[last.status] || 'none'}>{REV_LABEL[last.status] || last.status}</Pill></div><div>{last.summary}</div></> : <div style={{ color: C.soft }}>No versions yet.</div>}</section>
          </div>
          <h2>Revisions</h2>
          <div style={card}>{revs.length ? [...revs].reverse().map(revisionBlock) : <span style={{ color: C.soft }}>None yet.</span>}</div>
          {!doc.removed ? (
            revOpen ? (
              <section style={card}>
                <Field label="File" error={fieldErr.file} help="PDF, Word, Excel, DWG or ZIP. Up to 50 MB.">
                  <input type="file" aria-label="File" onChange={e => setRv({ ...rv, file: e.target.files?.[0] || null })} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Reason" error={fieldErr.reason}><Select label="Reason" value={rv.reason} onChange={v => setRv({ ...rv, reason: v })} options={R.REASONS.map(x => [x, x])} /></Field>
                  <Field label="Checker" error={fieldErr.checker}><Select label="Checker" value={rv.checker} onChange={v => setRv({ ...rv, checker: v })} options={props.members.map(m => [m, m])} /></Field>
                </div>
                <Field label="Approver" error={fieldErr.approver}><Select label="Approver" value={rv.approver} onChange={v => setRv({ ...rv, approver: v })} options={props.members.map(m => [m, m])} /></Field>
                <Field label="One-line summary" error={fieldErr.summary} help="What changed, and why. 20 to 280 characters."><input aria-label="Summary" value={rv.summary} onChange={e => setRv({ ...rv, summary: e.target.value })} style={input} /></Field>
                <Field label="Note for the checker" error={fieldErr.note}><textarea aria-label="Note for the checker" value={rv.note} onChange={e => setRv({ ...rv, note: e.target.value })} style={{ ...input, minHeight: 60 }} /></Field>
                <div style={row}><Btn kind="primary" onClick={() => run(() => props.reg.submitRevision(doc, revs, { ...rv, file: rv.file }), 'Sent for check.').then(() => setRevOpen(false))}>Send for check</Btn><Btn kind="link" onClick={() => setRevOpen(false)}>Cancel</Btn></div>
              </section>
            ) : <Btn onClick={() => setRevOpen(true)}>+ Add a new revision</Btn>
          ) : null}
        </>
      ) : null}

      {doc.kind === 'periodic' ? (
        <>
          <h2>Months</h2>
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead><tr>{['Period', 'Due', 'Status', 'Uploaded by', 'Summary', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: C.soft, textTransform: 'uppercase', borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {monthsOf(doc).map(key => {
                  const ps = periods.filter(p => p.periodKey === key);
                  const latest = ps.length ? ps[ps.length - 1] : undefined;
                  const st = R.periodState({ periodKey: key, dueDay: doc.dueDay || 1, uploadedAt: latest && !latest.notNeeded ? latest.uploadedAt : null, na: !!(latest && latest.notNeeded) });
                  const [label, tone] = PERIOD_LABEL[st] || ['', 'none'];
                  return (
                    <tr key={key} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: 10, fontFamily: MONO }}>{key}</td>
                      <td style={{ padding: 10 }}>{R.dueDate(key, doc.dueDay || 1)}</td>
                      <td style={{ padding: 10 }}>{label ? <Pill tone={tone}>{label}</Pill> : null}</td>
                      <td style={{ padding: 10 }}>{latest ? latest.uploader : '—'}</td>
                      <td style={{ padding: 10, fontSize: 13 }}>{latest ? (latest.notNeeded ? `Not needed: ${latest.notNeededReason}` : latest.summary) : ''}</td>
                      <td style={{ padding: 10 }}>
                        {st !== 'upcoming' && canUpload && !doc.removed ? <>
                          <Btn onClick={() => setPeriod({ key, mode: 'upload' })}>{latest && !latest.notNeeded ? 'Replace' : 'Upload'}</Btn>{' '}
                          <Btn kind="link" onClick={() => setPeriod({ key, mode: 'na' })}>Not needed</Btn>
                        </> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {period ? (
            <section style={card}>
              <h3>{period.mode === 'na' ? `Mark ${period.key} not needed` : `Upload ${period.key}`}</h3>
              {period.mode === 'upload' ? <>
                <Field label="File" error={fieldErr.file}><input type="file" aria-label="File" onChange={e => setPv({ ...pv, file: e.target.files?.[0] || null })} /></Field>
                <Field label="One-line summary" error={fieldErr.summary}><input aria-label="Summary" value={pv.summary} onChange={e => setPv({ ...pv, summary: e.target.value })} style={input} /></Field>
                <Field label="Why replace it? (only if one is already uploaded)" error={fieldErr.replaceReason}><input aria-label="Reason for replacing" value={pv.replaceReason} onChange={e => setPv({ ...pv, replaceReason: e.target.value })} style={input} /></Field>
              </> : <Field label="Why is it not needed?" error={fieldErr.naReason}><input aria-label="Reason" value={pv.naReason} onChange={e => setPv({ ...pv, naReason: e.target.value })} style={input} /></Field>}
              <div style={row}>
                <Btn kind="primary" onClick={() => run(async () => {
                  if (period.mode === 'na') await props.reg.markNotNeeded(doc, period.key, pv.naReason);
                  else await props.reg.uploadPeriod(doc, period.key, { file: pv.file, summary: pv.summary, replaceReason: pv.replaceReason });
                  setPeriod(null); setPv({ file: null, summary: '', replaceReason: '', naReason: '' });
                }, 'Saved.')}>Save</Btn>
                <Btn kind="link" onClick={() => setPeriod(null)}>Cancel</Btn>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {doc.kind === 'record' ? (
        <>
          <h2>Current certificate</h2>
          <div style={card}>
            {certs.length ? (() => { const v = certs[certs.length - 1]; const s = R.recordState(v.expiresOn);
              return <><Pill tone={s.state === 'valid' ? 'ok' : s.state === 'expiring' ? 'wait' : 'bad'}>{s.state === 'valid' ? 'Valid' : s.state === 'expiring' ? 'Expiring soon' : 'Expired'}</Pill>
                <div style={{ marginTop: 8 }}><b>Expires</b> {v.expiresOn} · {s.days < 0 ? 'expired' : `${s.days} days left`}</div>
                <div style={{ fontSize: 13, color: C.soft }}>{v.fileName} · uploaded {v.uploadedAt.slice(0, 10)} by {v.uploader}</div>
                <div>{v.summary}</div></>; })() : <span style={{ color: C.soft }}>No certificate yet.</span>}
          </div>
          {!doc.removed && canUpload ? (renewOpen ? (
            <section style={card}>
              <Field label="File" error={fieldErr.file}><input type="file" aria-label="File" onChange={e => setRenew({ ...renew, file: e.target.files?.[0] || null })} /></Field>
              <Field label="New expiry date" error={fieldErr.expiresOn}><input type="date" aria-label="New expiry date" value={renew.expiresOn} onChange={e => setRenew({ ...renew, expiresOn: e.target.value })} style={{ ...input, maxWidth: 220 }} /></Field>
              <Field label="One-line summary" error={fieldErr.summary}><input aria-label="Summary" value={renew.summary} onChange={e => setRenew({ ...renew, summary: e.target.value })} style={input} /></Field>
              <div style={row}><Btn kind="primary" onClick={() => run(() => props.reg.renew(doc, certs, renew), 'Renewal saved.').then(() => setRenewOpen(false))}>Save renewal</Btn><Btn kind="link" onClick={() => setRenewOpen(false)}>Cancel</Btn></div>
            </section>
          ) : <Btn onClick={() => setRenewOpen(true)}>Upload renewal</Btn>) : null}
        </>
      ) : null}

      <h2>Remove</h2>
      {doc.removed ? (
        <>
          <Notice tone="warn">Removed. The file is renamed to <span style={{ fontFamily: MONO }}>{doc.spName}</span>. Nothing was erased.</Notice>
          {canRemove ? <Btn kind="ok" onClick={() => run(() => props.reg.restoreDocument(doc), 'Restored.')}>Restore</Btn> : null}
        </>
      ) : removeOpen ? (
        <section style={card}>
          <Notice tone="warn">The document is hidden. Its file is renamed to DELETED_… in the library. Nothing is erased.</Notice>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Reason" error={fieldErr.reason}><Select label="Reason" value={remove.reason} onChange={v => setRemove({ ...remove, reason: v })} options={['Duplicate of another record', 'Created in error', 'No longer needed', 'Replaced by another document'].map(x => [x, x])} /></Field>
            <Field label="Why, in a sentence" error={fieldErr.text}><input aria-label="Why" value={remove.text} onChange={e => setRemove({ ...remove, text: e.target.value })} style={input} placeholder="At least 20 characters" /></Field>
          </div>
          <div style={row}><Btn kind="danger" onClick={() => run(() => props.reg.removeDocument(doc, remove.reason, remove.text), 'Removed. Renamed, not erased.').then(() => setRemoveOpen(false))}>Remove document</Btn><Btn kind="link" onClick={() => setRemoveOpen(false)}>Cancel</Btn></div>
        </section>
      ) : (
        <>
          <Btn kind="danger" disabled={!canRemove} onClick={() => setRemoveOpen(true)}>Remove document</Btn>{' '}
          <span style={{ fontSize: 13, color: C.soft }}>{canRemove ? 'You can remove this. Nothing is erased.' : 'You need the remove permission to remove a document. Ask an admin.'}</span>
        </>
      )}

      <h2>Recent activity</h2>
      <div style={{ ...card, fontSize: 14 }}>
        {audit.length ? audit.map(a => (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
            <span style={{ color: C.soft, fontSize: 13 }}>{a.when.slice(0, 16).replace('T', ' ')} · {a.who}</span><span><b>{a.action}</b> {a.detail}</span>
          </div>
        )) : <span style={{ color: C.soft }}>Nothing yet.</span>}
      </div>
    </div>
  );
}

/* Months from the series start up to this month, newest first. */
function monthsOf(doc: DocumentRow): string[] {
  const out: string[] = [];
  const start = doc.startPeriod || R.monthKey();
  for (let k = start; k <= R.monthKey(); k = R.addMonths(k, 1)) out.push(k);
  return out.reverse();
}
