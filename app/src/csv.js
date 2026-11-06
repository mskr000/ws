'use strict';
/* Reads a folder-structure CSV. Pure: no database. The service checks type codes against the database. */

/* Minimal CSV reader: commas, double quotes, "" for a quote inside quotes, CRLF or LF line ends. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (q) return { error: 'A quote is not closed. Check the file.' };
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { rows: rows.filter(r => r.some(x => x.trim() !== '')) };
}

/*
 * Expected columns:  folder, types
 *   folder  full path, levels separated by "/" (e.g. EPC/02 Engineering/02.1 Process)
 *   types   optional. Document type codes that file into this folder, separated by ";" (e.g. PID;PFD)
 * A header row is optional. If "types" is blank for every row, the caller applies the standard filing.
 */
function parseFolderCsv(text) {
  const parsed = parseCsv(text);
  if (parsed.error) return { errors: [{ line: 0, message: parsed.error }], folders: [], types: [] };
  let rows = parsed.rows.map((r, i) => ({ line: i + 1, cells: r.map(c => c.trim()) }));
  if (rows.length && rows[0].cells[0].toLowerCase() === 'folder') rows = rows.slice(1);
  const errors = [], folders = [], types = [];
  const seenFolders = new Set(), seenTypes = new Map();
  let anyTypes = false;
  for (const { line, cells } of rows) {
    const folder = cells[0] || '';
    if (!folder) { errors.push({ line, message: 'Folder is empty.' }); continue; }
    if (seenFolders.has(folder)) { errors.push({ line, message: `"${folder}" is listed twice.` }); continue; }
    seenFolders.add(folder);
    folders.push(folder);
    const codes = (cells[1] || '').split(';').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length) anyTypes = true;
    for (const code of codes) {
      if (seenTypes.has(code)) { errors.push({ line, message: `Type ${code} is filed twice (lines ${seenTypes.get(code)} and ${line}).` }); continue; }
      seenTypes.set(code, line);
      types.push({ code, folder, line });
    }
  }
  if (!folders.length && !errors.length) errors.push({ line: 0, message: 'The file has no folders.' });
  return { folders, types, anyTypes, errors };
}

module.exports = { parseCsv, parseFolderCsv };
