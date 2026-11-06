import * as React from 'react';
import type { ProjectInfo } from '../domain/types';
import * as R from '../domain/rules';
import { transmittalCsv, transmittalText, TransmittalLine, TransmittalRow, nextTransmittalNumber, emailDraft } from '../domain/transmittal';
import { Register, Me } from '../services/register';
import { Btn, Field, Notice, Select, Title, Section, Table, th, td, card, input, row, C, MONO, FONT, hint } from './ui';

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

export function TransmittalPage(props: { reg: Register; me: Me; projects: ProjectInfo[] }) {
  const [project, setProject] = React.useState(props.projects[0]?.code || '');
  const [rows, setRows] = React.useState<Array<TransmittalLine & { id: number }> | null>(null);
  const [picked, setPicked] = React.useState<number[]>([]);
  const [to, setTo] = React.useState('');
  const [purpose, setPurpose] = React.useState('For review');
  const [notes, setNotes] = React.useState('');
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [issued, setIssued] = React.useState<TransmittalRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const today = R.isoDay();
  const reloadIssued = React.useCallback(() => {
    if (project) props.reg.transmittals(project).then(setIssued).catch(e => setErr(String((e as Error).message || e)));
  }, [project, props.reg]);
  React.useEffect(() => { reloadIssued(); }, [reloadIssued]);

  React.useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setRows(null); setPicked([]); setErr('');
    props.reg.documents(project)
      .then(docs => Promise.all(docs.filter(d => !d.removed).map(async d => ({ id: d.id, number: d.number, title: d.title, standing: await standingOf(props.reg, d) }))))
      .then(r => { if (!cancelled) setRows(r); })
      .catch(e => { if (!cancelled) setErr(String((e as Error).message || e)); });
    return () => { cancelled = true; };
  }, [project]);

  const chosen = (rows || []).filter(r => picked.includes(r.id));
  const input_ = { to, date: today, purpose, notes, lines: chosen.map(({ number, title, standing }) => ({ number, title, standing })) };
  const text = transmittalText(input_);
  const fileBase = `transmittal-${project}-${today}`;

  const download = () => {
    const blob = new Blob(['﻿' + transmittalCsv(input_)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`Saved as ${fileBase}.csv`);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg('Copied. Paste it into an email.'); }
    catch { setMsg('Could not copy here. Select the text below and copy it.'); }
  };
  const issue = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const number = await props.reg.issueTransmittal({ project, to, purpose, notes, lines: chosen.map(({ number, title, standing }) => ({ number, title, standing })) });
      setMsg(`Issued ${number}. It is recorded and the list is saved in the register.`);
      setPicked([]);
      reloadIssued();
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally { setBusy(false); }
  };
  const nextNo = nextTransmittalNumber(project, issued.map(t => t.number));
  const projectName = props.projects.find(p => p.code === project)?.name || project;
  const mail = emailDraft({ number: nextNo, projectName, to, date: today, purpose, from: props.me.name, lines: input_.lines });
  const copyMail = async () => {
    try { await navigator.clipboard.writeText(`Subject: ${mail.subject}\n\n${mail.body}`); setMsg('Email copied. Paste it into Outlook and attach the list.'); }
    catch { setMsg('Could not copy here. Select the email text and copy it.'); }
  };
  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  return (
    <div>
      <Title sub="Pick documents, add who it is for, then save or copy the list.">Transmittal</Title>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div style={card}>
        <div style={{ ...row, alignItems: 'flex-end' }}>
          <Select label="Project" value={project} onChange={setProject} options={props.projects.map(p => [p.code, `${p.name} (${p.code})`])} width={320} />
        </div>
        <div style={{ marginTop: 14, ...row, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 240px' }}><Field label="To"><input aria-label="To" value={to} onChange={e => setTo(e.target.value)} placeholder="Client or contractor" style={input} /></Field></div>
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

      <div style={card}>
        <div style={{ ...hint, marginBottom: 8 }}>{chosen.length} document{chosen.length === 1 ? '' : 's'} on this list</div>
        <pre aria-label="Transmittal text" style={{ margin: 0, background: C.bg, borderRadius: 10, padding: 14, fontFamily: MONO, fontSize: 13, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{text}</pre>
        <div style={{ ...row, marginTop: 12 }}>
          <Btn kind="primary" disabled={chosen.length === 0} onClick={download}>Save as CSV</Btn>
          <Btn disabled={chosen.length === 0} onClick={copy}>Copy text</Btn>
          <Btn kind="primary" disabled={chosen.length === 0 || busy} onClick={issue}>{busy ? 'Issuing…' : `Issue as ${nextNo}`}</Btn>
        </div>
        {msg ? <div style={{ ...hint, marginTop: 10 }}>{msg}</div> : null}
        {err ? <Notice tone="bad">{err}</Notice> : null}
      </div>

      <Section title="Email text">
        <div style={card}>
          <div style={{ ...hint, marginBottom: 8 }}>Copied, not sent. Attach the saved list. Sending from the register needs a mail connection. See TRANSMITTAL_DESIGN.md.</div>
          <pre aria-label="Email text" style={{ margin: 0, background: C.bg, borderRadius: 10, padding: 14, fontFamily: FONT, fontSize: 14, whiteSpace: 'pre-wrap' }}>{`Subject: ${mail.subject}\n\n${mail.body}`}</pre>
          <div style={{ ...row, marginTop: 12 }}><Btn disabled={chosen.length === 0} onClick={copyMail}>Copy email</Btn></div>
        </div>
      </Section>

      <Section title="Issued transmittals">
        <Table minWidth={620}>
          <thead><tr><th style={th}>Number</th><th style={th}>Date</th><th style={th}>To</th><th style={th}>Purpose</th><th style={th}>Documents</th><th style={th}>Issued by</th><th style={th} /></tr></thead>
          <tbody>
            {issued.length === 0 ? <tr><td style={{ ...td, color: C.soft }} colSpan={7}>None issued for this project yet.</td></tr> : null}
            {issued.map(t => (
              <tr key={t.id} className="dr-row">
                <td style={{ ...td, fontFamily: MONO, fontSize: 13 }}>{t.number}</td>
                <td style={td}>{t.date}</td>
                <td style={td}>{t.to}</td>
                <td style={td}>{t.purpose}</td>
                <td style={td}>{t.lines.length}</td>
                <td style={td}>{t.issuedBy}</td>
                <td style={{ ...td, textAlign: 'right' }}>{t.fileUrl ? <a href={t.fileUrl} download={`${t.number}.csv`} style={{ color: C.accent, fontSize: 14 }}>Download list</a> : null}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
