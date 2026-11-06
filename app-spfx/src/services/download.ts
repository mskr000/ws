/* Browser downloads. One file: a plain download. Several files: one ZIP, built here. */
import { buildZip } from '../domain/zip';

export interface FileRef { url: string; name: string }

function saveBlob(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function downloadFiles(files: FileRef[], zipName: string): Promise<void> {
  if (files.length === 1) {
    const a = document.createElement('a');
    a.href = files[0].url;
    a.download = files[0].name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const entries = await Promise.all(files.map(async f => {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`Could not get ${f.name}.`);
    return { name: f.name, data: new Uint8Array(await res.arrayBuffer()) };
  }));
  saveBlob(new Blob([buildZip(entries)], { type: 'application/zip' }), zipName);
}

/* Save text as a file. Used for CSV exports. A UTF-8 byte-order mark keeps Excel from garbling accents. */
export function saveText(text: string, fileName: string, type = 'text/csv;charset=utf-8'): void {
  saveBlob(new Blob(['﻿' + text], { type }), fileName);
}
