/* Transmittal: a cover list of documents for a client or contractor. Pure text and CSV. */

export interface TransmittalLine { number: string; title: string; standing: string }
export interface TransmittalRow {
  id: number; number: string; project: string; to: string; toEmail: string; date: string; purpose: string; notes: string; lines: TransmittalLine[];
  fileUrl: string; checksum: string; pdfUrl: string; pdfChecksum: string; issuedBy: string;
  status: 'Recorded' | 'Held' | 'Sent' | 'Cancelled'; heldAt: string; sentAt: string;
}
export interface TransmittalInput { to: string; date: string; purpose: string; notes: string; lines: TransmittalLine[] }

/* A cell that starts with = + - @ can run as a formula in Excel. Prefix it with an apostrophe. */
export function csvCell(value: string): string {
  let v = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n]/.test(v) || v.startsWith("'") ? `"${v.replace(/"/g, '""')}"` : v;
}

export function transmittalCsv(t: TransmittalInput): string {
  const head = [['To', t.to], ['Date', t.date], ['Purpose', t.purpose], ['Notes', t.notes], [], ['Number', 'Title', 'Where it stands']];
  const rows = t.lines.map(l => [l.number, l.title, l.standing]);
  return [...head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

export function transmittalText(t: TransmittalInput): string {
  const lines = t.lines.map(l => `${l.number}\t${l.title}\t${l.standing}`);
  return ['TRANSMITTAL', `To: ${t.to || '(not set)'}`, `Date: ${t.date}`, `Purpose: ${t.purpose}`, t.notes ? `Notes: ${t.notes}` : '', '', 'Number\tTitle\tWhere it stands', ...lines]
    .filter((x, i, a) => x !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
}

/* Numbers run per project: TX-U100-0001, TX-U100-0002 ... never reused, even if a record is later withdrawn. */
export function nextTransmittalNumber(project: string, existing: string[]): string {
  const prefix = `TX-${project}-`;
  const used = existing.filter(n => n.startsWith(prefix)).map(n => parseInt(n.slice(prefix.length), 10)).filter(n => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/* The email text. It is copied, not sent: sending needs a mail connection (see TRANSMITTAL_DESIGN.md). */
export function emailDraft(t: { number: string; projectName: string; to: string; date: string; purpose: string; from: string; lines: TransmittalLine[] }): { subject: string; body: string } {
  const subject = `Transmittal ${t.number} · ${t.projectName} · ${t.purpose}`;
  const list = t.lines.map(l => `  - ${l.number} ${l.title} (${l.standing})`).join('\n');
  const body = [
    `${t.to ? `Dear ${t.to},` : 'Hello,'}`,
    '',
    `Please find transmittal ${t.number} dated ${t.date} for ${t.purpose.toLowerCase()}.`,
    '',
    'Documents on this transmittal:',
    list || '  (none)',
    '',
    'The transmittal list is attached as a file. The files are available from the register on request.',
    '',
    'Regards,',
    t.from,
  ].join('\n');
  return { subject, body };
}

/* The lines of the PDF copy kept as evidence. Same content as the list, with who, when and where it was sent. */
export function transmittalPdfLines(t: { number: string; to: string; toEmail: string; date: string; purpose: string; notes: string; issuedBy: string; lines: TransmittalLine[]; status: string; sentAt: string }): string[] {
  return [
    `Transmittal number: ${t.number}`,
    `Date: ${t.date}`,
    `To: ${t.to}${t.toEmail ? ` <${t.toEmail}>` : ''}`,
    `Purpose: ${t.purpose}`,
    t.notes ? `Notes: ${t.notes}` : '',
    `Issued by: ${t.issuedBy}`,
    t.sentAt ? `Emailed: ${t.sentAt.slice(0, 16).replace('T', ' ')} UTC` : `Status: ${t.status}`,
    '',
    'Documents:',
    ...t.lines.map((l, i) => `${i + 1}. ${l.number}  ${l.title}  (${l.standing})`),
  ].filter(x => x !== undefined);
}
