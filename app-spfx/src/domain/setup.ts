/* Project setup rules: codes, folders, document types, templates and the folder CSV reader.
   Ported from app/src/rules.js, app/src/csv.js and app/src/template.js. Pure: no SharePoint. */
import { DEFAULT_PATTERN, patternError, DocKind } from './numbering';
import type { Errors } from './rules';

export const CODE_RE = /^[A-Z0-9]{2,5}$/;
const FOLDER_SEG_RE = /^[A-Za-z0-9][A-Za-z0-9 .&()\-]{0,59}$/;

/* The standard folder list. Every leaf is a real folder. */
export const STANDARD_FOLDERS: string[] = [
  'EPC/01 Project Management',
  'EPC/02 Engineering/02.1 Process', 'EPC/02 Engineering/02.2 Piping', 'EPC/02 Engineering/02.3 Electrical',
  'EPC/02 Engineering/02.4 Instrumentation & Control', 'EPC/02 Engineering/02.5 Civil & Structural',
  'EPC/03 Procurement/03.1 Requisitions', 'EPC/03 Procurement/03.2 Purchase Orders', 'EPC/03 Procurement/03.3 Vendor Documents',
  'EPC/04 Construction/04.1 Method Statements', 'EPC/04 Construction/04.2 Inspection & Test Plans', 'EPC/04 Construction/04.3 Daily Reports',
  'EPC/05 Commissioning', 'EPC/06 Handover/06.1 As-Built', 'EPC/06 Handover/06.2 O&M Manuals',
  'Operations/01 Manuals', 'Operations/02 SOPs', 'Operations/03 Maintenance', 'Operations/04 Permits', 'Operations/05 Reports', 'Operations/06 Certificates',
];

export interface DocTypeDef { code: string; label: string; kind: DocKind; folder: string }
/* The document type library. Same codes as the local app. */
export const DOC_TYPES: DocTypeDef[] = [
  { code: 'PID', label: 'P&ID', kind: 'controlled', folder: 'EPC/02 Engineering/02.1 Process' },
  { code: 'PFD', label: 'Process flow diagram', kind: 'controlled', folder: 'EPC/02 Engineering/02.1 Process' },
  { code: 'ISO', label: 'Piping isometric', kind: 'controlled', folder: 'EPC/02 Engineering/02.2 Piping' },
  { code: 'SLD', label: 'Single line diagram', kind: 'controlled', folder: 'EPC/02 Engineering/02.3 Electrical' },
  { code: 'CNT', label: 'Control narrative', kind: 'controlled', folder: 'EPC/02 Engineering/02.4 Instrumentation & Control' },
  { code: 'FND', label: 'Foundation layout', kind: 'controlled', folder: 'EPC/02 Engineering/02.5 Civil & Structural' },
  { code: 'PLN', label: 'Project execution plan', kind: 'controlled', folder: 'EPC/01 Project Management' },
  { code: 'PO', label: 'Purchase order', kind: 'controlled', folder: 'EPC/03 Procurement/03.2 Purchase Orders' },
  { code: 'VDR', label: 'Vendor document', kind: 'controlled', folder: 'EPC/03 Procurement/03.3 Vendor Documents' },
  { code: 'MS', label: 'Method statement', kind: 'controlled', folder: 'EPC/04 Construction/04.1 Method Statements' },
  { code: 'ITP', label: 'Inspection and test plan', kind: 'controlled', folder: 'EPC/04 Construction/04.2 Inspection & Test Plans' },
  { code: 'ABD', label: 'As-built drawing', kind: 'controlled', folder: 'EPC/06 Handover/06.1 As-Built' },
  { code: 'OM', label: 'O&M manual', kind: 'controlled', folder: 'EPC/06 Handover/06.2 O&M Manuals' },
  { code: 'WRK', label: 'Working document (uncontrolled)', kind: 'working', folder: 'Working documents' },
  { code: 'MAN', label: 'Operations manual', kind: 'controlled', folder: 'Operations/01 Manuals' },
  { code: 'SOP', label: 'Standard operating procedure', kind: 'controlled', folder: 'Operations/02 SOPs' },
  { code: 'MNT', label: 'Monthly maintenance check', kind: 'periodic', folder: 'Operations/03 Maintenance' },
  { code: 'RPT', label: 'Monthly operations report', kind: 'periodic', folder: 'Operations/05 Reports' },
  { code: 'CERT', label: 'Certificate or inspection', kind: 'record', folder: 'Operations/06 Certificates' },
  { code: 'PTW', label: 'Permit to work template', kind: 'record', folder: 'Operations/04 Permits' },
];
export const typeDef = (code: string): DocTypeDef | undefined => DOC_TYPES.find(t => t.code === code);

export function folderPathError(path: string): string | null {
  const segs = String(path || '').split('/');
  if (segs.length < 1 || segs.length > 4) return 'Folder path can have 1 to 4 levels.';
  for (const s of segs) {
    if (!FOLDER_SEG_RE.test(s.trim()) || s !== s.trim()) return `"${s}" is not a valid folder name.`;
  }
  return null;
}

export interface SetupType { code: string; enabled: boolean; folder: string; firstNumber: number }
export interface ProjectSetup {
  code: string; name: string; status: 'active' | 'archived'; numberPattern: string;
  folders: string[]; types: SetupType[];
}

/* Full check of a project setup. Returns { field: message }. Keys: code, name, folders, types, numberPattern,
   folder:<path>, type:<code>, first:<code>. */
export function projectSetupErrors(p: ProjectSetup, isNew: boolean, existingCodes: string[]): Errors {
  const e: Errors = {};
  if (isNew) {
    if (!CODE_RE.test(p.code || '')) e.code = 'Project code: 2 to 5 capital letters or digits, for example U100.';
    else if (existingCodes.includes(p.code)) e.code = `${p.code} already exists.`;
  }
  if (!(p.name || '').trim()) e.name = 'Give the project a name.';
  const pe = patternError(p.numberPattern);
  if (pe) e.numberPattern = pe;
  if (!p.folders.length) e.folders = 'Add at least one folder.';
  else {
    const seen = new Set<string>();
    for (const f of p.folders) {
      const err = folderPathError(f);
      if (err) e[`folder:${f}`] = err;
      if (seen.has(f)) e[`folder:${f}`] = 'This folder is listed twice.';
      seen.add(f);
    }
  }
  const on = p.types.filter(t => t.enabled);
  if (!on.length) e.types = 'Turn on at least one document type.';
  for (const t of on) {
    if (!typeDef(t.code)) e[`type:${t.code}`] = 'Unknown document type.';
    if (!p.folders.includes(t.folder)) e[`type:${t.code}`] = `${t.code} must file into one of the project folders.`;
    if (!Number.isInteger(t.firstNumber) || t.firstNumber < 1 || t.firstNumber > 9999) e[`first:${t.code}`] = 'First number must be between 1 and 9999.';
  }
  return e;
}

/* ---------- Templates ---------- */
export interface TemplateDef { id: string; name: string; description: string; numberPattern: string; folders: string[]; types: SetupType[]; builtIn: boolean }

const typesOf = (codes: string[]): SetupType[] => codes.map(code => ({ code, enabled: true, folder: typeDef(code)!.folder, firstNumber: 1 }));
const EPC = STANDARD_FOLDERS.filter(f => f.startsWith('EPC/'));
const OPS = STANDARD_FOLDERS.filter(f => f.startsWith('Operations/'));

/* O&M (operations and maintenance) structure, as agreed. Folder names use "-" where a name needs a separator.
   Subfolders of "Warranty/Other equipment" are not defined yet; add them on the project when known. */
const CORRECTIVE_SUB = ['Maintenance schedule', 'Outage request notification', 'Work orders', 'Logs', 'Test results', 'Maintenance records', 'Defect register'];
export const OM_FOLDERS: string[] = [
  'Engineering/Drawings', 'Engineering/Drawings/As-built drawings', 'Engineering/NCN', 'Engineering/PPC',
  'Change management/Change request', 'Change management/ABCD',
  'Equipment space/Asset-equipment list', 'Equipment space/Spare inventory', 'Equipment space/Tools', 'Equipment space/Certificates',
  'Equipment space/Calibration', 'Equipment space/Licenses', 'Equipment space/Logistics', 'Equipment space/Obsolete', 'Equipment space/Vendor list',
  'Contract-legal/Correspondence-letter', 'Contract-legal/Grid code compliance', 'Contract-legal/Vendor contracts', 'Contract-legal/Vendor codes',
  'Contract-legal/Variations', 'Contract-legal/Quotes to customers', 'Contract-legal/Claims', 'Contract-legal/Insurance',
  ...['Corrective', 'Preventative'].flatMap(k => [`Engineering maintenance engagement/${k}`, ...CORRECTIVE_SUB.map(x => `Engineering maintenance engagement/${k}/${x}`)]),
  'Operations/Monthly reports', 'Operations/KPI calculation report', 'Operations/Procedures', 'Operations/Communication protocols', 'Operations/O&M plan',
  'Operations/OEM manuals', 'Operations/Minutes of meetings', 'Operations/OEM updates', 'Operations/CMMS',
  'HSEQ/HSE management plan', 'HSEQ/Safety and incident reports', 'HSEQ/Risk assessment', 'HSEQ/Site inductions', 'HSEQ/Site access',
  'HSEQ/Health and hygiene', 'HSEQ/Audit and inspections', 'HSEQ/Emergency drills', 'HSEQ/Pest control', 'HSEQ/Permits to work', 'HSEQ/Environmental permits',
  'Training/Training records', 'Training/OEM training', 'Training/Training certificate',
  'Warranty/Batteries', 'Warranty/Inverters', 'Warranty/Other equipment',
  'Finance/Budget', 'Finance/Cost tracking', 'Finance/Vendor bills', 'Finance/Customer invoices', 'Finance/Purchase orders', 'Finance/Vendor quotes',
  'EPC related/Punch list', 'EPC related/Commissioning and handover',
];
const om = (code: string, label: string, kind: DocKind, folder: string) => ({ code, label, kind, folder });
export const OM_TYPES: DocTypeDef[] = [
  om('MAN', 'OEM manual', 'controlled', 'Operations/OEM manuals'),
  om('SOP', 'Procedure', 'controlled', 'Operations/Procedures'),
  om('RPT', 'Monthly report', 'periodic', 'Operations/Monthly reports'),
  om('MNT', 'Preventative check record', 'periodic', 'Engineering maintenance engagement/Preventative/Maintenance records'),
  om('PTW', 'Permit to work', 'record', 'HSEQ/Permits to work'),
  om('CERT', 'Certificate', 'record', 'Equipment space/Certificates'),
];

export const BUILT_IN_TEMPLATES: TemplateDef[] = [
  { id: 'internal-workspace', name: 'Internal workspace (no approval)', description: 'For your own files, team working or unofficial work. One folder, uncontrolled documents only: no check, no approval.',
    numberPattern: DEFAULT_PATTERN, folders: ['Working documents'], types: typesOf(['WRK']), builtIn: true },
  { id: 'om-standard', name: 'O&M (operations and maintenance)', description: 'Standard O&M structure: engineering, change management, equipment, contracts, maintenance, operations, HSEQ, training, warranty, finance, EPC handover.',
    numberPattern: DEFAULT_PATTERN, folders: OM_FOLDERS, types: OM_TYPES.map(t => ({ code: t.code, enabled: true, folder: t.folder, firstNumber: 1 })), builtIn: true },
  { id: 'epc-standard', name: 'EPC project (standard)', description: 'Full EPC structure: project management, engineering, procurement, construction, commissioning and handover. Every EPC document type on.',
    numberPattern: DEFAULT_PATTERN, folders: EPC, types: typesOf(DOC_TYPES.filter(t => t.folder.startsWith('EPC/')).map(t => t.code)), builtIn: true },
  { id: 'operations-only', name: 'Operations (plant running)', description: 'For a plant in operation: manuals, SOPs, monthly checks, permits, monthly reports and certificates.',
    numberPattern: DEFAULT_PATTERN, folders: OPS, types: typesOf(['MAN', 'SOP', 'MNT', 'RPT', 'PTW', 'CERT']), builtIn: true },
  { id: 'engineering-drawings', name: 'Engineering drawings only', description: 'Small engineering job: P&IDs, isometrics, single line diagrams, method statements and the execution plan.',
    numberPattern: DEFAULT_PATTERN,
    folders: ['EPC/01 Project Management', 'EPC/02 Engineering/02.1 Process', 'EPC/02 Engineering/02.2 Piping', 'EPC/02 Engineering/02.3 Electrical', 'EPC/04 Construction/04.1 Method Statements'],
    types: typesOf(['PLN', 'PID', 'ISO', 'SLD', 'MS']), builtIn: true },
];

/* ---------- Folder CSV ----------
   Columns: folder, types (optional, codes separated by ";"). A header row is optional.
   If no row has types, each standard type goes to its standard folder when that folder is in the file. */
export function parseCsv(text: string): { rows: string[][] } | { error: string } {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
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

export interface CsvLine { line: number; message: string }
export interface CsvResult { folders: string[]; types: SetupType[]; usedDefaults: boolean; errors: CsvLine[] }

export function readFolderCsv(text: string): CsvResult {
  const parsed = parseCsv(text);
  if ('error' in parsed) return { folders: [], types: [], usedDefaults: false, errors: [{ line: 0, message: parsed.error }] };
  let rows = parsed.rows.map((r, i) => ({ line: i + 1, cells: r.map(c => c.trim()) }));
  if (rows.length && rows[0].cells[0].toLowerCase() === 'folder') rows = rows.slice(1);
  const errors: CsvLine[] = [], folders: string[] = [], types: SetupType[] = [];
  const seenFolders = new Set<string>(), seenTypes = new Map<string, number>();
  let anyTypes = false;
  for (const { line, cells } of rows) {
    const folder = cells[0] || '';
    if (!folder) { errors.push({ line, message: 'Folder is empty.' }); continue; }
    const bad = folderPathError(folder);
    if (bad) { errors.push({ line, message: bad }); continue; }
    if (seenFolders.has(folder)) { errors.push({ line, message: `"${folder}" is listed twice.` }); continue; }
    seenFolders.add(folder);
    folders.push(folder);
    const codes = (cells[1] || '').split(';').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length) anyTypes = true;
    for (const code of codes) {
      if (seenTypes.has(code)) { errors.push({ line, message: `Type ${code} is filed twice (lines ${seenTypes.get(code)} and ${line}).` }); continue; }
      if (!typeDef(code)) { errors.push({ line, message: `Type ${code} is not in the document type list.` }); continue; }
      seenTypes.set(code, line);
      types.push({ code, enabled: true, folder, firstNumber: 1 });
    }
  }
  if (!folders.length && !errors.length) errors.push({ line: 0, message: 'The file has no folders.' });
  let usedDefaults = false;
  if (!anyTypes && folders.length) {
    usedDefaults = true;
    for (const t of DOC_TYPES) if (folders.includes(t.folder)) types.push({ code: t.code, enabled: true, folder: t.folder, firstNumber: 1 });
  }
  return { folders, types, usedDefaults, errors };
}
