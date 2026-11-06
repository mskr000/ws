/* A plain PDF with text lines. No library. Enough for a transmittal copy kept as evidence. */

function esc(s: string): string {
  return s.replace(/[\\()]/g, c => '\\' + c).replace(/[^\x20-\x7e]/g, '?');
}

/* Lines of text, one per row, in Helvetica. A4 page, a new page when the lines run out. */
export function textPdf(title: string, lines: string[]): Uint8Array {
  const PAGE_LINES = 46;
  const pages: string[][] = [];
  const all = [title, '', ...lines];
  for (let i = 0; i < all.length; i += PAGE_LINES) pages.push(all.slice(i, i + PAGE_LINES));
  if (pages.length === 0) pages.push(['']);

  const objs: string[] = [];
  const add = (body: string) => { objs.push(body); return objs.length; };
  const catalog = add('');        // 1
  const pagesObj = add('');       // 2
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids: number[] = [];
  for (const page of pages) {
    const text = ['BT', '/F1 10 Tf', '13 TL', '50 790 Td',
      ...page.map((l, i) => (i === 0 ? `/F1 14 Tf (${esc(l)}) Tj` : `(${esc(l)}) Tj`)).join('\nT*\n').split('\n'), 'ET'].join('\n');
    const content = add(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    const pageObj = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
    kids.push(pageObj);
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
