import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import * as R from '../domain/rules';
import * as MAIL from '../domain/mail';
import { transmittalCsv, TransmittalLine, TransmittalRow, nextTransmittalNumber, emailDraft } from '../domain/transmittal';
import { Register, Me } from '../services/register';
import { Btn, Field, Notice, Select, Title, Section, Table, th, td, card, input, row, C, MONO, FONT, hint, DownloadIcon, Pill } from './ui';

/* Where a document stands, in words, for the cover list. */
async function standingOf(reg: Register, d: { id: number; kind: string }): Promise<string> {
  if (d.kind === 'controlled') {
    const revs = await reg.revisions(d.id);
    const approved = revs.filter(r => r.status === 'Approved').sort((a, b) => b.n - a.n)[0];
    if (approved) return `Current: Rev ${approved.n}`;
    const last = revs.sort((a, b) => b.n - a.n)[0];
    return last ? `Rev ${last.n}, not yet approved` : 'No revision on file';
  }
  if (d.kind === 'periodic') {
    const ps = (await reg.periods(d.id)).filter(p => !p.notNeeded && p.uploadedAt).sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
    return ps[0] ? `Latest upload: ${ps[0].periodKey}` : 'Nothing uploaded yet';
  }
  const certs = (await reg.certificates(d.id)).sort((a, b) => b.n - a.n);
  return certs[0] ? `Certificate expires ${certs[0].expiresOn}` : 'No certificate on file';
}

const STATUS_TONE: Record<string, 'ok' | 'wait' | 'bad' | 'none' | 'check'> = { Sent: 'ok', Held: 'wait', Cancelled: 'bad', Recorded: 'none' };

export function TransmittalPage(props: { reg: Register; me: Me; projects: ProjectInfo[] }) {
  const [project, setProject] = React.useState(props.projects[0]?.code || '');
  const [rows, setRows] = React.useState<Array<TransmittalLine & { id: number }> | null>(null);
  const [picked, setPicked] = React.useState<number[]>([]);
  const [to, setTo] = React.useState('');
  const [toEmail, setToEmail] = React.useState('');
  const [purpose, setPurpose] = React.useState('For review');
  const [notes, setNotes] = React.useState('');
  const [issued, setIssued] = React.useState<TransmittalRow[]>([]);
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [held, setHeld] = React.useState<{ number: string; to: string; heldAt: string } | null>(null);
  const [left, setLeft] = React.useState(MAIL.UNDO_SECONDS);
  const firing = React.useRef(false);
  const today = R.isoDay();

  const reloadIssued = React.useCallback(() => {
    if (project) props.reg.transmittals(project).then(setIssued).catch(e => setErr(String((e as Error).message || e)));
  }, [project, props.reg]);

  React.useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setRows(null); setPicked([]); setErr('');
    props.reg.documents(project)
      .then(docs => Promise.all(docs.filter(d => !d.removed).map(async d => ({ id: d.id, number: d.number, title: d.title, standing: await standingOf(props.reg, d) }))))
      .then(r => { if (!cancelled) setRows(r); })
      .catch(e => { if (!cancelled) setErr(String((e as Error).message || e)); });
    reloadIssued();
    return () => { cancelled = true; };
  }, [project, props.reg, reloadIssued]);

  const chosen = (rows || []).filter(r => picked.includes(r.id));
  const lines = chosen.map(({ number, title, standing }) => ({ number, title, standing }));
  const preview = { to, date: today, purpose, notes, lines };
  const projectName = props.projects.find(p => p.code === project)?.name || project;
  const nextNo = nextTransmittalNumber(project, issued.map(t => t.number));
  const mail = emailDraft({ number: nextNo, projectName, to, date: today, purpose, from: props.me.name, lines });
  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const emailOk = MAIL.validEmail(toEmail);

  /* Send, or undo, for a transmittal by its number. Looks up the current row first. */
  const findRow = async (number: string): Promise<TransmittalRow> => {
    const t = (await props.reg.transmittals(project)).find(x => x.number === number);
    if (!t) throw new Error(`${number} was not found.`);
    return t;
  };
  const sendNow = React.useCallback(async (number: string) => {
    try {
      await props.reg.sendHeld(await findRow(number));
      setMsg(`${number} emailed.`); setHeld(null);
    } catch (e) { setErr(String((e as Error).message || e)); setHeld(null); }
    finally { reloadIssued(); firing.current = false; }
  }, [props.reg, project, reloadIssued]);
  const undo = async (number: string) => {
    try {
      await props.reg.cancelHeld(await findRow(number));
      setMsg(`${number} undone. Not emailed. The record is kept.`); setHeld(null);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { reloadIssued(); firing.current = false; }
  };

  /* Countdown for the undo window. When it ends, the email goes. */
  React.useEffect(() => {
    if (!held) return;
    const tick = () => {
      const s = MAIL.secondsLeft(held.heldAt, new Date().toISOString());
      setLeft(s);
      if (s <= 0 && !firing.current) { firing.current = true; sendNow(held.number); }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [held, sendNow]);

  const issue = async (send: boolean) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const number = await props.reg.issueTransmittal({ project, to, toEmail, purpose, notes, lines, send });
      setPicked([]);
      reloadIssued();
      if (send) {
        firing.current = false;
        setHeld({ number, to: to.trim(), heldAt: new Date().toISOString() });
        setLeft(MAIL.UNDO_SECONDS);
      } else setMsg(`${number} recorded. Not emailed.`);
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally { setBusy(false); }
  };

  const downloadPreview = () => {
    const blob = new Blob(['﻿' + transmittalCsv(preview)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `transmittal-draft-${project}-${today}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copyMail = async () => {
    try { await navigator.clipboard.writeText(`To: ${toEmail}\nSubject: ${mail.subject}\n\n${mail.body}`); setMsg('Email copied.'); }
    catch { setMsg('Could not copy here. Select the email text and copy it.'); }
  };

  return (
    <div>
      <Title sub="Choose documents, add who it is for, and send. You can undo for 60 seconds. Every send is recorded.">Transmittal</Title>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      {msg ? <Notice tone="ok">{msg}</Notice> : null}

      {held ? (
        <div style={{ ...card, borderLeft: `4px solid ${C.accent}` }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{held.number} will be emailed to {held.to} in {left} second{left === 1 ? '' : 's'}.</div>
          <div style={hint}>Nothing has left yet. Undo keeps the record and does not send the email.</div>
          <div style={{ ...row, marginTop: 12 }}>
            <Btn kind="danger" onClick={() => { firing.current = true; undo(held.number); }}>Undo</Btn>
            <Btn kind="primary" onClick={() => { firing.current = true; sendNow(held.number); }}>Send now</Btn>
          </div>
        </div>
      ) : null}

      <div style={card}>
        <div style={{ ...row, alignItems: 'flex-end' }}>
          <Select label="Project" value={project} onChange={setProject} options={props.projects.map(p => [p.code, `${p.name} (${p.code})`])} width={320} />
        </div>
        <div style={{ marginTop: 14, ...row, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 220px' }}><Field label="Sent to (name)"><input aria-label="To" value={to} onChange={e => setTo(e.target.value)} placeholder="Client or contractor" style={input} /></Field></div>
          <div style={{ flex: '1 1 260px' }}><Field label="Recipient email" error={toEmail && !emailOk ? 'Enter a full address, e.g. name@company.com' : undefined} help="Stored with the record. Needed to send."><input aria-label="Recipient email" type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="name@company.com" style={input} /></Field></div>
          <div style={{ flex: '1 1 200px' }}><Field label="Purpose"><input aria-label="Purpose" value={purpose} onChange={e => setPurpose(e.target.value)} style={input} /></Field></div>
        </div>
        <Field label="Notes (optional)"><input aria-label="Notes" value={notes} onChange={e => setNotes(e.target.value)} style={input} /></Field>
      </div>

      <div style={card}>
        {rows === null && !err ? <div style={hint}>Loading documents…</div> : null}
        {rows && rows.length === 0 ? <div style={hint}>No documents in this project yet.</div> : null}
        {rows && rows.length ? (
          <Table minWidth={560}>
            <thead><tr><th style={th} /><th style={th}>Number</th><th style={th}>Title</th><th style={th}>Where it stands</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="dr-row">
                  <td style={td}><input type="checkbox" aria-label={`Include ${r.number}`} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 13 }}>{r.number}</td>
                  <td style={td}>{r.title}</td>
                  <td style={{ ...td, color: C.soft, fontSize: 14 }}>{r.standing}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </div>

      <Section title="Send">
        <div style={card}>
          <div style={{ ...hint, marginBottom: 8 }}>{chosen.length} document{chosen.length === 1 ? '' : 's'} on this transmittal. Next number: <span style={{ fontFamily: MONO }}>{nextNo}</span></div>
          <div style={{ ...row, marginTop: 4 }}>
            <Btn kind="primary" disabled={chosen.length === 0 || !emailOk || !to.trim() || busy || !!held} onClick={() => issue(true)}>{busy ? 'Working…' : 'Send by email (undo for 60 seconds)'}</Btn>
            <Btn disabled={chosen.length === 0 || busy} onClick={() => issue(false)}>Record only, do not email</Btn>
            <Btn disabled={chosen.length === 0} onClick={downloadPreview}>Save draft list (CSV)</Btn>
          </div>
          <div style={{ ...hint, marginTop: 10 }}>The email goes from your own Microsoft 365 mailbox. It carries the list (CSV) and a PDF copy. The PDF is kept with the record as evidence.</div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Email text</div>
          <pre aria-label="Email text" style={{ margin: 0, background: C.bg, borderRadius: 10, padding: 14, fontFamily: FONT, fontSize: 14, whiteSpace: 'pre-wrap' }}>{`To: ${toEmail || '(recipient email)'}\nSubject: ${mail.subject}\n\n${mail.body}`}</pre>
          <div style={{ ...row, marginTop: 12 }}><Btn disabled={chosen.length === 0} onClick={copyMail}>Copy email</Btn></div>
        </div>
      </Section>

      <Section title="Issued transmittals">
        <Table minWidth={760}>
          <thead><tr><th style={th}>Number</th><th style={th}>Date</th><th style={th}>To</th><th style={th}>Purpose</th><th style={th}>Docs</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {issued.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={7}>None issued for this project yet.</td></tr> : null}
            {issued.map(t => {
              const mine = t.issuedBy === props.me.name;
              return (
                <tr key={t.id} className="dr-row">
                  <td style={{ ...td, fontFamily: MONO, fontSize: 13 }}>{t.number}</td>
                  <td style={td}>{t.date}</td>
                  <td style={td}><div>{t.to}</div>{t.toEmail ? <div style={{ fontSize: 12, color: C.soft }}>{t.toEmail}</div> : null}</td>
                  <td style={td}>{t.purpose}</td>
                  <td style={td}>{t.lines.length}</td>
                  <td style={td}>
                    <Pill tone={STATUS_TONE[t.status] || 'none'}>{t.status === 'Sent' ? `Emailed ${t.sentAt.slice(0, 10)}` : t.status === 'Held' ? 'Held (undo window)' : t.status}</Pill>
                    <div style={{ fontSize: 12, color: C.soft, marginTop: 4 }}>by {t.issuedBy}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {t.status === 'Held' && mine ? <>
                      <Btn kind="link" onClick={() => undo(t.number)}>Undo</Btn>{' '}
                      <Btn kind="link" onClick={() => { firing.current = true; sendNow(t.number); }}>Send now</Btn>
                    </> : null}
                    {t.pdfUrl ? <DownloadIcon href={t.pdfUrl} fileName={`${t.number}.pdf`} label={`Download PDF copy of ${t.number}`} /> : null}
                    {t.fileUrl ? <DownloadIcon href={t.fileUrl} fileName={`${t.number}.csv`} label={`Download list ${t.number}`} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
