/* Transmittal: a cover list of documents for a client or contractor. Pure text and CSV. */

export interface TransmittalLine { number: string; title: string; standing: string }
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
