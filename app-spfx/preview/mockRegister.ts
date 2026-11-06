/* Preview only. Same methods as src/services/register.ts, backed by memory. Used to show the screens without SharePoint. */
import * as R from '../src/domain/rules';
import * as N from '../src/domain/numbering';
import type { ProjectInfo, DocTypeInfo, DocumentRow, RevisionRow, PeriodRow, CertRow, AuditRow } from '../src/domain/types';
import { RuleError } from '../src/services/register';
import * as SU from '../src/domain/setup';
import { sha256Hex } from '../src/domain/sha';
import * as P from '../src/domain/permissions';
import * as DR from '../src/domain/drafts';
import * as TR from '../src/domain/transmittal';
import * as MAIL from '../src/domain/mail';
import * as CT from '../src/domain/contacts';
import * as CS from '../src/domain/selection';
import { textPdf } from '../src/domain/pdf';
import * as RT from '../src/domain/retention';
import * as TREE from '../src/domain/tree';

const DRAFTS: DR.DraftRow[] = [];
const TRANSMITTALS: TR.TransmittalRow[] = [];
/* Recipients. Companies group the people. Demo data only. */
const CONTACTS: CT.Contact[] = [
  { id: 901, company: 'Client A', name: 'Ana Reyes', email: 'ana@clienta.example', removed: false },
  { id: 902, company: 'Client A', name: 'Ben Okafor', email: 'ben@clienta.example', removed: false },
  { id: 903, company: 'Contractor B', name: 'Chen Wei', email: 'chen@contractorb.example', removed: false },
];
const draftDoc = (d: DR.DraftRow) => DR.canSeeDraft(d, ME, can('edit_any'));
import { buildDashboard } from '../src/domain/dashboard';

/* SHA-256 of the file the user picked. Same method as the SharePoint version. */
/* Demo: the file is kept in the browser, so its link downloads the real bytes. */
function urlOf(file: File | null): string { return file ? URL.createObjectURL(file) : ''; }
function seedUrl(name: string): string { return URL.createObjectURL(new Blob([`Demo file: ${name}\n`], { type: 'text/plain' })); }

async function sumOf(file: File | null): Promise<string> { return file ? sha256Hex(await file.arrayBuffer()) : ''; }

let ME = 'Sam';
/* Demo accounts. Admin manages access. Mia is Records Lead. Others are members. */
const GRANTS: P.Grant[] = [
  ...P.presetGrants('Admin', 'Admin', '*', '').map((g, i) => ({ ...g, id: 1 + i })),
  ...P.presetGrants('Records Lead', 'Mia', '*', '').map((g, i) => ({ ...g, id: 10 + i })),
];
let nextGrant = 100;
const can = (cap: P.Cap, project = '*', folder = '') => P.can({ name: ME, grants: GRANTS }, cap, project, folder);
export function signInAs(name: string) { ME = name; }
const MEMBERS = ['Admin', 'Mia', 'Priya', 'Sam', 'Tom'];
export const PREVIEW_PEOPLE = MEMBERS;
const PROJECTS: ProjectInfo[] = [
  { code: 'U100', name: 'Unit 100 Refinery', status: 'active', numberPattern: R.DEFAULT_PATTERN, kind: 'standard', owner: 'Mia' },
  { code: 'TF7', name: 'Tank Farm TF-7', status: 'active', numberPattern: R.DEFAULT_PATTERN, kind: 'standard', owner: 'Mia' },
  { code: 'OM1', name: 'O&M project (sample)', status: 'active', numberPattern: R.DEFAULT_PATTERN, kind: 'standard', owner: 'Mia' },
  { code: 'INT', name: 'Internal working (sample)', status: 'active', numberPattern: R.DEFAULT_PATTERN, kind: 'internal', owner: 'Sam' },
];
const TYPES: Record<string, DocTypeInfo[]> = {
  U100: [
    { code: 'PID', label: 'P&ID', kind: 'controlled', folder: 'EPC/02 Engineering/02.1 Process' },
    { code: 'SOP', label: 'Startup procedure', kind: 'controlled', folder: 'Operations/02 SOPs' },
    { code: 'MNT', label: 'Monthly maintenance check', kind: 'periodic', folder: 'Operations/03 Maintenance' },
    { code: 'RPT', label: 'Monthly operations report', kind: 'periodic', folder: 'Operations/05 Reports' },
    { code: 'CERT', label: 'Certificate or inspection', kind: 'record', folder: 'Operations/06 Certificates' },
  ],
  TF7: [{ code: 'PID', label: 'P&ID', kind: 'controlled', folder: 'EPC/02 Engineering/02.1 Process' }],
  OM1: SU.OM_TYPES.map(t => ({ ...t, folder: t.folder })),
  INT: [{ code: 'WRK', label: 'Working document (uncontrolled)', kind: 'working', folder: 'Working documents', firstNumber: 1 }],
};

let nextId = 100;
const docs: DocumentRow[] = [];
const revs: RevisionRow[] = [];
const periods: PeriodRow[] = [];
const certs: CertRow[] = [];
const audit: AuditRow[] = [];
const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString();

function seed() {
  const add = (d: Omit<DocumentRow, 'id'>) => { const row = { legalHold: false, holdReason: '', ...d, id: nextId++ }; docs.push(row); return row; };
  const pid = add({ number: 'U100-PID-1001', title: 'Pump layout, Unit 100', project: 'U100', type: 'PID', kind: 'controlled', folder: 'EPC/02 Engineering/02.1 Process', owner: 'Sam', removed: false, spName: 'U100-PID-1001.pdf', dueDay: null, startPeriod: null });
  const rv = (n: number, status: RevisionRow['status'], summary: string, extra: Partial<RevisionRow> = {}) =>
    revs.push({ id: nextId++, documentId: pid.id, n, status, reason: 'Design change', summary, note: 'Check the vents', uploader: 'Sam', checker: 'Priya', approver: 'Tom', checkedBy: '', approvedBy: '', returnNote: '', fileName: `U100-PID-1001_r${n}.pdf`, fileUrl: '#', checksum: '', createdAt: '2026-04-10', ...extra });
  rv(0, 'Approved', 'First issue for internal review.', { checkedBy: 'Priya', approvedBy: 'Tom', createdAt: '2026-02-03' });
  rv(1, 'Approved', 'Moved pump 300 mm north after the site survey.', { checkedBy: 'Priya', approvedBy: 'Tom', createdAt: '2026-04-10' });
  rv(2, 'Submitted', 'Added a bypass valve on the cooling line.', { createdAt: today() });

  const mnt = add({ number: 'U100-MNT-0001', title: 'Monthly pump vibration check', project: 'U100', type: 'MNT', kind: 'periodic', folder: 'Operations/03 Maintenance', owner: 'Mia', removed: false, spName: 'U100-MNT-0001.pdf', dueDay: 5, startPeriod: '2026-06' });
  ['2026-06', '2026-07', '2026-08'].forEach((k, i) => periods.push({ id: nextId++, documentId: mnt.id, periodKey: k, version: 1, notNeeded: false, notNeededReason: '', summary: 'All pumps within limits.', uploader: 'Mia', uploadedAt: `${k}-0${4 + i}T10:00:00Z`, fileUrl: seedUrl(`U100-MNT-0001_${k}.pdf`), replaceReason: '', checksum: '', fileName: `U100-MNT-0001_${k}.pdf` }));

  const cert = add({ number: 'U100-CERT-0001', title: 'Pressure vessel V-101 certificate', project: 'U100', type: 'CERT', kind: 'record', folder: 'Operations/06 Certificates', owner: 'Mia', removed: false, spName: 'U100-CERT-0001.pdf', dueDay: null, startPeriod: null });
  certs.push({ id: nextId++, documentId: cert.id, n: 0, summary: 'Certificate issued by inspector.', expiresOn: '2026-11-28', uploader: 'Mia', fileName: 'V101_cert.pdf', fileUrl: seedUrl('V101_cert.pdf'), uploadedAt: '2025-11-28', checksum: '' });

  audit.push({ id: nextId++, when: '2026-04-10T14:20:00Z', who: 'Tom', action: 'Approved', docNumber: 'U100-PID-1001', detail: 'rev 1 approved by Tom' });
  audit.push({ id: nextId++, when: '2026-02-03T09:00:00Z', who: 'Sam', action: 'Created document', docNumber: 'U100-PID-1001', detail: 'rev 0 waiting for Priya' });
}
seed();

export class MockRegister {
  async whoAmI() { return { name: ME, grants: GRANTS.slice() }; }
  async grants() { return GRANTS.filter(g => !g.revoked); }
  async addGrant(input: { user: string; project: string; folder: string; cap: P.Cap }) {
    if (!can('permissions')) throw new RuleError('You do not have permission to manage permissions. Ask an admin.');
    const problem = P.grantErrors(input, GRANTS);
    if (problem) throw new RuleError(problem);
    GRANTS.push({ ...input, id: nextGrant++ });
    this.log('Granted permission', '', `${input.user} · ${P.CAP_LABEL[input.cap]} · ${input.project}${input.folder ? ' / ' + input.folder : ''}`);
  }
  async removeGrant(g: P.Grant) {
    if (!can('permissions')) throw new RuleError('You do not have permission to manage permissions. Ask an admin.');
    if (g.cap === 'permissions' && GRANTS.filter(x => !x.revoked && x.cap === 'permissions' && x.project === '*').length <= 1) throw new RuleError('Keep at least one admin. Add another admin before removing this one.');
    g.revoked = true; /* kept, never deleted */
    this.log('Removed permission', '', `${g.user} · ${P.CAP_LABEL[g.cap]} · ${g.project}${g.folder ? ' / ' + g.folder : ''}`);
  }
  async members() { return MEMBERS; }
  async projects() { return PROJECTS; }
  async projectTypes(p: string) { return (TYPES[p] || []).map(t => ({ ...t, firstNumber: 1 })); }
  private setups: Record<string, SU.ProjectSetup> = {
    U100: { code: 'U100', name: 'Unit 100 Refinery', status: 'active', numberPattern: R.DEFAULT_PATTERN, folders: SU.STANDARD_FOLDERS.slice(),
      types: SU.DOC_TYPES.map(d => ({ code: d.code, enabled: ['PID','SOP','MNT','RPT','CERT'].includes(d.code), folder: d.folder, firstNumber: 1 })) },
    OM1: { code: 'OM1', name: 'O&M project (sample)', status: 'active', numberPattern: R.DEFAULT_PATTERN, folders: SU.OM_FOLDERS.slice(),
      types: SU.OM_TYPES.map(d => ({ code: d.code, enabled: true, folder: d.folder, firstNumber: 1 })) },
    INT: { code: 'INT', name: 'Internal working (sample)', status: 'active', numberPattern: R.DEFAULT_PATTERN, folders: ['Working documents'], kind: 'internal', owner: 'Sam',
      types: [{ code: 'WRK', enabled: true, folder: 'Working documents', firstNumber: 1 }] },
    TF7: { code: 'TF7', name: 'Tank Farm TF-7', status: 'active', numberPattern: R.DEFAULT_PATTERN, folders: ['EPC/02 Engineering/02.1 Process'],
      types: SU.DOC_TYPES.map(d => ({ code: d.code, enabled: d.code === 'PID', folder: 'EPC/02 Engineering/02.1 Process', firstNumber: 1 })) },
  };
  private savedTemplates: SU.TemplateDef[] = [];
  async projectSetup(code: string) {
    const setup = JSON.parse(JSON.stringify(this.setups[code]));
    const folderDocs: Record<string, number> = {}; const typeDocs: Record<string, number> = {};
    docs.filter(d => d.project === code).forEach(d => { typeDocs[d.type] = (typeDocs[d.type] || 0) + 1; setup.folders.forEach((f: string) => { if (d.folder === f || d.folder.startsWith(f + '/')) folderDocs[f] = (folderDocs[f] || 0) + 1; }); });
    return { setup, locked: docs.some(d => d.project === code), docsInFolder: folderDocs, docsOfType: typeDocs };
  }
  async createProject(setup: SU.ProjectSetup) {
    const kind = setup.kind || 'standard';
    if (!P.canCreateProject({ name: ME, grants: GRANTS }, kind)) throw new RuleError('You do not have permission to add a standard project. Ask an admin, or create an internal project.');
    const errors = SU.projectSetupErrors(setup, true, PROJECTS.map(p => p.code));
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    PROJECTS.push({ code: setup.code, name: setup.name, status: 'active', numberPattern: setup.numberPattern, kind, owner: ME });
    setup = { ...setup, kind, owner: ME };
    this.setups[setup.code] = setup;
    this.log('Created project', '', `${setup.code} · ${setup.name}`);
    return setup.code;
  }
  async updateProject(setup: SU.ProjectSetup, before: any, renames: TREE.Rename[] = []) {
    if (!P.canManageProject({ name: ME, grants: GRANTS }, { code: setup.code, kind: before.setup.kind || 'standard', owner: before.setup.owner || '' })) throw new RuleError('You do not have permission to change this project. Ask an admin.');
    const errors = SU.projectSetupErrors(setup, false, []);
    for (const f of before.setup.folders) if (!setup.folders.includes(TREE.applyRenames(f, renames)) && (before.docsInFolder[f] || 0) > 0) errors[`folder:${f}`] = `${before.docsInFolder[f]} document(s) are filed here. Move them first.`;
    for (const t of before.setup.types) { const still = setup.types.find((x: SU.SetupType) => x.code === t.code && x.enabled); if (!still && (before.docsOfType[t.code] || 0) > 0) errors[`type:${t.code}`] = `${before.docsOfType[t.code]} document(s) of this type exist.`; }
    if (before.locked && setup.numberPattern !== before.setup.numberPattern) errors.numberPattern = 'Numbering has started. The pattern cannot change now.';
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    for (const d of docs) { const to = TREE.applyRenames(d.folder, renames); if (to !== d.folder && d.project === setup.code) { this.log('Moved to renamed folder', d.number, `${d.folder} → ${to}`); d.folder = to; } }
    for (const r of renames) this.log('Renamed folder', '', `${r.from} → ${r.to}`);
    this.setups[setup.code] = setup;
    const p = PROJECTS.find(x => x.code === setup.code)!; p.name = setup.name; p.status = setup.status; p.numberPattern = setup.numberPattern;
    this.log('Changed project', '', setup.code);
    return 1;
  }
  async templates() { return [...SU.BUILT_IN_TEMPLATES, ...this.savedTemplates]; }
  async saveTemplate(name: string, description: string, setup: SU.ProjectSetup) {
    if (!can('projects')) throw new RuleError('You do not have permission to save a template. Ask an admin.');
    if (!name.trim()) throw new RuleError('Give the template a name.', { name: 'Give the template a name.' });
    this.savedTemplates.push({ id: 'saved-' + nextId++, name: name.trim(), description, numberPattern: setup.numberPattern, folders: setup.folders, types: setup.types.filter(t => t.enabled), builtIn: false });
  }
  previewFolderCsv(text: string) { return SU.readFolderCsv(text); }
  async dashboard(me: { name: string }, today: string) {
    const docList = docs.slice();
    return buildDashboard({
      me: me.name, today, projects: PROJECTS, docs: docList,
      revisions: revs.map(r => ({ documentId: r.documentId, n: r.n, status: r.status, checker: r.checker, approver: r.approver, by: r.uploader })),
      periods: periods.slice(), certificates: certs.slice(),
    });
  }
  async uploadWorking(doc: DocumentRow, list: RevisionRow[], input: any) {
    const denied = R.canUploadSeries(doc.owner, ME, can('edit_any', doc.project, doc.folder));
    if (denied) throw new RuleError(denied);
    const errors = { ...R.fileErrors(input.file ? { name: input.file.name, size: input.file.size } : null), ...R.summaryErrors(input.summary) };
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = list.length ? Math.max(...list.map(r => r.n)) + 1 : 0;
    const cs = await sumOf(input.file);
    revs.push({ id: nextId++, documentId: doc.id, n, status: 'Working', reason: '', summary: input.summary.trim(), note: '', uploader: ME, checker: '', approver: '', checkedBy: '', approvedBy: '', returnNote: '', fileName: input.file.name, fileUrl: urlOf(input.file), checksum: cs, createdAt: today() });
    this.log('Uploaded new version', doc.number, `v${n} · no check or approval`);
  }
  async transmittals(project: string) { return TRANSMITTALS.filter(t => t.project === project); }
  async contacts() { return CONTACTS.slice(); }
  /* Same contract as the SharePoint version: one page at a time. */
  async findDocuments(project: string, o: { folder?: string; text?: string; numbers?: string[]; skip: number; take: number }) {
    let list = docs.filter(d => d.project === project);
    if (o.folder) list = list.filter(d => d.folder === o.folder || d.folder.startsWith(o.folder + '/'));
    if (o.numbers && o.numbers.length) list = list.filter(d => o.numbers!.includes(d.number));
    else if (o.text && o.text.trim()) { const t = o.text.trim().toLowerCase(); list = list.filter(d => d.number.toLowerCase().includes(t) || d.title.toLowerCase().includes(t)); }
    list = list.slice().sort((a, b) => a.number.localeCompare(b.number));
    return { docs: list.slice(o.skip, o.skip + o.take), more: list.length > o.skip + o.take };
  }
  async filesFor(list: DocumentRow[]): Promise<CS.CandidateFile[]> {
    return list.flatMap(d => CS.candidatesOf(d, revs.filter(r => r.documentId === d.id), periods.filter(p => p.documentId === d.id), certs.filter(c => c.documentId === d.id)));
  }
  async addContact(input: { company: string; name: string; email: string }) {
    const errors = CT.contactErrors(input, CONTACTS);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    CONTACTS.push({ id: nextId++, company: input.company.trim(), name: input.name.trim(), email: input.email.trim(), removed: false });
    this.log('Added recipient', '', `${input.name.trim()} · ${input.company.trim()}`);
  }
  async removeContact(c: CT.Contact) {
    const row = CONTACTS.find(x => x.id === c.id)!;
    row.removed = true;
    this.log('Removed recipient', '', `${c.name} · ${c.company}. Kept, marked removed.`);
  }
  /* Demo: nothing is really emailed. The status moves the same way it does in SharePoint. */
  async issueTransmittal(input: any): Promise<string> {
    if (!input.to.trim()) throw new RuleError('Choose who it is for.', { to: 'Choose who it is for.' });
    if (!input.purpose.trim()) throw new RuleError('Say why it is sent.', { purpose: 'Say why it is sent.' });
    if (!input.lines.length) throw new RuleError('Choose at least one document.');
    const over = CS.overLimit(input.lines.length);
    if (over) throw new RuleError(over);
    if (input.lines.some((l: any) => l.status && l.status !== 'current') && !input.ack) throw new RuleError('Some files are not the current version. Confirm that they should go out.', { ack: 'Confirm the files that are not current.' });
    if (input.send && (!input.toEmails.length || input.toEmails.some((e: string) => !MAIL.validEmail(e)))) throw new RuleError('Choose at least one recipient with a valid email address.');
    const number = TR.nextTransmittalNumber(input.project, TRANSMITTALS.map(t => t.number));
    const date = today();
    const base = { number, to: input.to.trim(), toEmail: input.toEmails.join('; '), date, purpose: input.purpose.trim(), notes: input.notes.trim(), issuedBy: ME, lines: input.lines, status: input.send ? 'Held' : 'Recorded', sentAt: '' };
    const csv = TR.transmittalCsv({ to: base.to, date, purpose: base.purpose, notes: base.notes, lines: input.lines });
    const pdf = new File([textPdf(`Transmittal ${number}`, TR.transmittalPdfLines(base))], `${number}.pdf`, { type: 'application/pdf' });
    TRANSMITTALS.unshift({ id: nextId++, project: input.project, fileUrl: urlOf(new File(['﻿' + csv], `${number}.csv`, { type: 'text/csv' })), checksum: await sumOf(new File([csv], 'x.csv')),
      pdfUrl: urlOf(pdf), pdfChecksum: await sumOf(pdf), heldAt: input.send ? new Date().toISOString() : '', ...base } as any);
    this.log(input.send ? 'Issued transmittal, held for undo' : 'Issued transmittal, not emailed', number, `${base.to} · ${base.purpose} · ${input.lines.length} document(s)`);
    return number;
  }
  async sendHeld(t: TR.TransmittalRow) {
    if (t.issuedBy !== ME) throw new RuleError('Only the person who issued this transmittal can send it.');
    if (t.status !== 'Held') throw new RuleError(`This transmittal is ${t.status.toLowerCase()}. It cannot be sent.`);
    const row = TRANSMITTALS.find(x => x.id === t.id)!;
    row.status = 'Sent'; row.sentAt = new Date().toISOString();
    this.log('Sent transmittal by email', t.number, `to ${t.toEmail} (demo: not really emailed)`);
  }
  async cancelHeld(t: TR.TransmittalRow) {
    if (t.issuedBy !== ME) throw new RuleError('Only the person who issued this transmittal can undo it.');
    if (t.status !== 'Held') throw new RuleError(`This transmittal is ${t.status.toLowerCase()}. Nothing to undo.`);
    if (!MAIL.canUndo(t.heldAt, new Date().toISOString())) throw new RuleError('The undo time has passed. The email has gone.');
    const row = TRANSMITTALS.find(x => x.id === t.id)!;
    row.status = 'Cancelled';
    this.log('Cancelled transmittal email (undo)', t.number, `to ${t.toEmail}. Record kept.`);
  }
  async planData(project: string) {
    const ids = new Set(docs.filter(d => d.project === project).map(d => d.id));
    return { folders: this.setups[project].folders.slice(), docs: docs.filter(d => d.project === project),
      revs: revs.filter(r => ids.has(r.documentId)), periods: periods.filter(p => ids.has(p.documentId)), certs: certs.filter(c => ids.has(c.documentId)) };
  }
  async drafts(documentId: number): Promise<DR.DraftRow[]> {
    return DRAFTS.filter(d => d.documentId === documentId).filter(draftDoc).slice().reverse();
  }
  async addDraft(doc: DocumentRow, input: { file: File | null; note: string }) {
    const errors = DR.draftErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, note: input.note });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const cs = await sumOf(input.file);
    DRAFTS.push({ id: nextId++, documentId: doc.id, owner: ME, note: input.note.trim(), fileName: input.file!.name, fileUrl: urlOf(input.file), checksum: cs, createdAt: today(), discarded: false });
    this.log('Added working draft', doc.number, `${ME} · not a revision`);
  }
  async discardDraft(doc: DocumentRow, d: DR.DraftRow) {
    const problem = DR.canDiscardDraft(d, ME, can('edit_any'));
    if (problem) throw new RuleError(problem);
    d.discarded = true;
    this.log('Discarded working draft', doc.number, `${d.owner}. Kept in the library.`);
  }
  async documents(project?: string) { return docs.filter(d => !project || d.project === project); }
  async allDocumentNumbers() { return docs.map(d => d.number); }
  async revisions(id: number) { return revs.filter(r => r.documentId === id); }
  async periods(id: number) { return periods.filter(p => p.documentId === id); }
  async certificates(id: number) { return certs.filter(c => c.documentId === id); }
  async audit(id?: number, limit = 200) { return audit.filter(a => !id || docs.find(d => d.id === id)?.number === a.docNumber).slice(0, limit); }
  private log(action: string, number: string, detail: string) { audit.unshift({ id: nextId++, when: stamp(), who: ME, action, docNumber: number, detail }); }

  async createDocument(input: any): Promise<number> {
    const number = N.nextNumber({ pattern: input.project.numberPattern, project: input.project.code, type: input.type.code, existing: docs.map(d => d.number) });
    const errors: R.Errors = {};
    if (!input.title.trim()) errors.title = 'Give it a title.';
    if (input.type.kind === 'controlled') {
      Object.assign(errors, R.revisionErrors({ uploader: ME, checker: input.checker || '', approver: input.approver || '', reason: input.reason || '', summary: input.summary || '', note: input.note || '', file: input.file ? { name: input.file.name, size: input.file.size } : null }));
    } else if (input.type.kind === 'working') {
      Object.assign(errors, R.fileErrors(input.file ? { name: input.file.name, size: input.file.size } : null), R.summaryErrors(input.summary || ''));
    } else if (input.type.kind === 'record') {
      Object.assign(errors, R.fileErrors(input.file ? { name: input.file.name, size: input.file.size } : null), R.summaryErrors(input.summary || ''));
      if (!input.expiresOn || input.expiresOn <= today()) errors.expiresOn = 'Enter an expiry date after today.';
    } else if (!(input.dueDay >= 1 && input.dueDay <= 28)) errors.dueDay = 'Due day must be 1 to 28.';
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const cs = await sumOf(input.file);
    const d: DocumentRow = { legalHold: false, holdReason: '', id: nextId++, number, title: input.title.trim(), project: input.project.code, type: input.type.code, kind: input.type.kind, folder: input.type.folder, owner: input.owner, removed: false, spName: `${number}.pdf`, dueDay: input.dueDay ?? null, startPeriod: input.startPeriod ?? null };
    docs.push(d);
    if (input.type.kind === 'working') revs.push({ id: nextId++, documentId: d.id, n: 0, status: 'Working', reason: '', summary: input.summary.trim(), note: '', uploader: ME, checker: '', approver: '', checkedBy: '', approvedBy: '', returnNote: '', fileName: input.file.name, fileUrl: urlOf(input.file), checksum: cs, createdAt: today() });
    if (input.type.kind === 'controlled') revs.push({ id: nextId++, documentId: d.id, n: 0, status: 'Submitted', reason: input.reason, summary: input.summary.trim(), note: input.note.trim(), uploader: ME, checker: input.checker, approver: input.approver, checkedBy: '', approvedBy: '', returnNote: '', fileName: input.file.name, fileUrl: urlOf(input.file), checksum: cs, createdAt: today() });
    this.log('Created document', number, `${d.title}`);
    return d.id;
  }
  private rule(problem: string | null) { if (problem) throw new RuleError(problem); }
  async submitRevision(doc: DocumentRow, list: RevisionRow[], input: any) {
    const errors = R.revisionErrors({ uploader: ME, checker: input.checker, approver: input.approver, reason: input.reason, summary: input.summary, note: input.note, file: input.file ? { name: input.file.name, size: input.file.size } : null });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = list.length ? Math.max(...list.map(r => r.n)) + 1 : 0;
    const cs = await sumOf(input.file);
    revs.push({ id: nextId++, documentId: doc.id, n, status: 'Submitted', reason: input.reason, summary: input.summary.trim(), note: input.note.trim(), uploader: ME, checker: input.checker, approver: input.approver, checkedBy: '', approvedBy: '', returnNote: '', fileName: input.file.name, fileUrl: urlOf(input.file), checksum: cs, createdAt: today() });
    this.log('Added revision', doc.number, `rev ${n}`);
    return n;
  }
  async check(rev: RevisionRow, doc: DocumentRow) { this.rule(R.canCheck({ status: rev.status as R.RevStatus, by: rev.uploader, checker: rev.checker, approver: rev.approver }, ME)); rev.status = 'Checked'; rev.checkedBy = ME; this.log('Checked', doc.number, `rev ${rev.n}`); }
  async approve(rev: RevisionRow, doc: DocumentRow) { this.rule(R.canApprove({ status: rev.status as R.RevStatus, by: rev.uploader, checker: rev.checker, approver: rev.approver }, ME)); rev.status = 'Approved'; rev.approvedBy = ME; this.log('Approved', doc.number, `rev ${rev.n}`); }
  async sendBack(rev: RevisionRow, doc: DocumentRow, text: string) {
    this.rule(R.canReturn({ status: rev.status as R.RevStatus, by: rev.uploader, checker: rev.checker, approver: rev.approver }, ME));
    if (text.trim().length < 10) throw new RuleError('Write at least 10 characters to say what must change.', { text: 'Write at least 10 characters.' });
    rev.status = 'Returned'; rev.returnNote = text.trim(); this.log('Returned', doc.number, text.trim());
  }
  async uploadPeriod(doc: DocumentRow, key: string, input: any) {
    this.rule(R.canUploadSeries(doc.owner, ME, can('edit_any', doc.project, doc.folder)));
    const errors = R.periodErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, summary: input.summary, replaceReason: input.replaceReason, existing: input.existing });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const cs = await sumOf(input.file);
    periods.push({ id: nextId++, documentId: doc.id, periodKey: key, version: 1, notNeeded: false, notNeededReason: '', summary: input.summary.trim(), uploader: ME, uploadedAt: stamp(), fileUrl: urlOf(input.file), replaceReason: '', checksum: cs, fileName: input.file.name });
    this.log('Uploaded period', doc.number, key);
  }
  async markNotNeeded(doc: DocumentRow, key: string, reason: string) {
    this.rule(R.canUploadSeries(doc.owner, ME, can('edit_any', doc.project, doc.folder)));
    const errors = R.naErrors(reason);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    periods.push({ id: nextId++, documentId: doc.id, periodKey: key, version: 1, notNeeded: true, notNeededReason: reason, summary: '', uploader: ME, uploadedAt: stamp(), fileUrl: '', replaceReason: '', checksum: '' });
    this.log('Marked not needed', doc.number, `${key}: ${reason}`);
  }
  async renew(doc: DocumentRow, list: CertRow[], input: any) {
    this.rule(R.canUploadSeries(doc.owner, ME, can('edit_any', doc.project, doc.folder)));
    const errors = R.renewalErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, summary: input.summary, expiresOn: input.expiresOn });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const cs = await sumOf(input.file);
    certs.push({ id: nextId++, documentId: doc.id, n: list.length, summary: input.summary.trim(), expiresOn: input.expiresOn, uploader: ME, fileName: input.file.name, fileUrl: urlOf(input.file), uploadedAt: stamp(), checksum: cs });
    this.log('Renewed certificate', doc.number, input.expiresOn);
  }
  async setLegalHold(doc: DocumentRow, on: boolean, reason: string) {
    if (!can('remove', doc.project, doc.folder)) throw new RuleError('You do not have permission to ' + (on ? 'place' : 'release') + ' a legal hold. Ask an admin.');
    const errors = RT.holdErrors(reason);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    doc.legalHold = on; doc.holdReason = on ? reason.trim() : '';
    this.log(on ? 'Legal hold placed' : 'Legal hold released', doc.number, reason.trim());
  }
  async removeDocument(doc: DocumentRow, reason: string, text: string) {
    this.rule(R.canRemove(can('remove', doc.project, doc.folder)));
    const last = RT.lastActivity([...revs.filter(r => r.documentId === doc.id).map(r => r.createdAt), ...periods.filter(p => p.documentId === doc.id).map(p => p.uploadedAt), ...certs.filter(c => c.documentId === doc.id).map(c => c.uploadedAt)], today());
    const held = RT.removalBlock({ legalHold: doc.legalHold, lastActivityDay: last, today: today() });
    if (held) throw new RuleError(held);
    const errors = R.removeErrors(reason, text);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    doc.removed = true; doc.spName = `DELETED_${today().replace(/-/g, '')}_${doc.number}.pdf`;
    this.log('Removed document', doc.number, `${reason}: ${text}. Renamed. Nothing erased.`);
    return doc.spName;
  }
  async restoreDocument(doc: DocumentRow) { this.rule(R.canRemove(can('remove', doc.project, doc.folder))); doc.removed = false; doc.spName = `${doc.number}.pdf`; this.log('Restored document', doc.number, 'Name set back.'); }
}
