/* Preview only. Same methods as src/services/register.ts, backed by memory. Used to show the screens without SharePoint. */
import * as R from '../src/domain/rules';
import * as N from '../src/domain/numbering';
import type { ProjectInfo, DocTypeInfo, DocumentRow, RevisionRow, PeriodRow, CertRow, AuditRow } from '../src/domain/types';
import { RuleError } from '../src/services/register';
import * as SU from '../src/domain/setup';
import { sha256Hex } from '../src/domain/sha';
import * as P from '../src/domain/permissions';
import { buildDashboard } from '../src/domain/dashboard';

/* SHA-256 of the file the user picked. Same method as the SharePoint version. */
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
  { code: 'U100', name: 'Unit 100 Refinery', status: 'active', numberPattern: R.DEFAULT_PATTERN },
  { code: 'TF7', name: 'Tank Farm TF-7', status: 'active', numberPattern: R.DEFAULT_PATTERN },
  { code: 'OM1', name: 'O&M project (sample)', status: 'active', numberPattern: R.DEFAULT_PATTERN },
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
  const add = (d: Omit<DocumentRow, 'id'>) => { const row = { ...d, id: nextId++ }; docs.push(row); return row; };
  const pid = add({ number: 'U100-PID-1001', title: 'Pump layout, Unit 100', project: 'U100', type: 'PID', kind: 'controlled', folder: 'EPC/02 Engineering/02.1 Process', owner: 'Sam', removed: false, spName: 'U100-PID-1001.pdf', dueDay: null, startPeriod: null });
  const rv = (n: number, status: RevisionRow['status'], summary: string, extra: Partial<RevisionRow> = {}) =>
    revs.push({ id: nextId++, documentId: pid.id, n, status, reason: 'Design change', summary, note: 'Check the vents', uploader: 'Sam', checker: 'Priya', approver: 'Tom', checkedBy: '', approvedBy: '', returnNote: '', fileName: `U100-PID-1001_r${n}.pdf`, fileUrl: '#', checksum: '', createdAt: '2026-04-10', ...extra });
  rv(0, 'Approved', 'First issue for internal review.', { checkedBy: 'Priya', approvedBy: 'Tom', createdAt: '2026-02-03' });
  rv(1, 'Approved', 'Moved pump 300 mm north after the site survey.', { checkedBy: 'Priya', approvedBy: 'Tom', createdAt: '2026-04-10' });
  rv(2, 'Submitted', 'Added a bypass valve on the cooling line.', { createdAt: today() });

  const mnt = add({ number: 'U100-MNT-0001', title: 'Monthly pump vibration check', project: 'U100', type: 'MNT', kind: 'periodic', folder: 'Operations/03 Maintenance', owner: 'Mia', removed: false, spName: 'U100-MNT-0001.pdf', dueDay: 5, startPeriod: '2026-06' });
  ['2026-06', '2026-07', '2026-08'].forEach((k, i) => periods.push({ id: nextId++, documentId: mnt.id, periodKey: k, version: 1, notNeeded: false, notNeededReason: '', summary: 'All pumps within limits.', uploader: 'Mia', uploadedAt: `${k}-0${4 + i}T10:00:00Z`, fileUrl: '#', replaceReason: '', checksum: '' }));

  const cert = add({ number: 'U100-CERT-0001', title: 'Pressure vessel V-101 certificate', project: 'U100', type: 'CERT', kind: 'record', folder: 'Operations/06 Certificates', owner: 'Mia', removed: false, spName: 'U100-CERT-0001.pdf', dueDay: null, startPeriod: null });
  certs.push({ id: nextId++, documentId: cert.id, n: 0, summary: 'Certificate issued by inspector.', expiresOn: '2026-11-28', uploader: 'Mia', fileName: 'V101_cert.pdf', fileUrl: '#', uploadedAt: '2025-11-28', checksum: '' });

  audit.push({ id: nextId++, when: '2026-04-10T14:20:00Z', who: 'Tom', action: 'Approved', docNumber: 'U100-PID-1001', detail: 'rev 1 approved by Tom' });
  audit.push({ id: nextId++, when: '2026-02-03T09:00:00Z', who: 'Sam', action: 'Created document', docNumber: 'U100-PID-1001', detail: 'rev 0 waiting for Priya' });
}
seed();

export class MockRegister {
  async whoAmI() { return { name: ME, grants: GRANTS.slice() }; }
  async grants() { return GRANTS.slice(); }
  async addGrant(input: { user: string; project: string; folder: string; cap: P.Cap }) {
    if (!can('permissions')) throw new RuleError('You do not have permission to manage permissions. Ask an admin.');
    const problem = P.grantErrors(input, GRANTS);
    if (problem) throw new RuleError(problem);
    GRANTS.push({ ...input, id: nextGrant++ });
    this.log('Granted permission', '', `${input.user} · ${P.CAP_LABEL[input.cap]} · ${input.project}${input.folder ? ' / ' + input.folder : ''}`);
  }
  async removeGrant(g: P.Grant) {
    if (!can('permissions')) throw new RuleError('You do not have permission to manage permissions. Ask an admin.');
    if (g.cap === 'permissions' && GRANTS.filter(x => x.cap === 'permissions' && x.project === '*').length <= 1) throw new RuleError('Keep at least one admin. Add another admin before removing this one.');
    GRANTS.splice(GRANTS.indexOf(g), 1);
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
    if (!can('projects')) throw new RuleError('You do not have permission to add a project. Ask an admin.');
    const errors = SU.projectSetupErrors(setup, true, PROJECTS.map(p => p.code));
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    PROJECTS.push({ code: setup.code, name: setup.name, status: 'active', numberPattern: setup.numberPattern });
    this.setups[setup.code] = setup;
    this.log('Created project', '', `${setup.code} · ${setup.name}`);
    return setup.code;
  }
  async updateProject(setup: SU.ProjectSetup, before: any) {
    if (!can('projects', setup.code)) throw new RuleError('You do not have permission to change this project. Ask an admin.');
    const errors = SU.projectSetupErrors(setup, false, []);
    for (const f of before.setup.folders) if (!setup.folders.includes(f) && (before.docsInFolder[f] || 0) > 0) errors[`folder:${f}`] = `${before.docsInFolder[f]} document(s) are filed here. Move them first.`;
    for (const t of before.setup.types) { const still = setup.types.find((x: SU.SetupType) => x.code === t.code && x.enabled); if (!still && (before.docsOfType[t.code] || 0) > 0) errors[`type:${t.code}`] = `${before.docsOfType[t.code]} document(s) of this type exist.`; }
    if (before.locked && setup.numberPattern !== before.setup.numberPattern) errors.numberPattern = 'Numbering has started. The pattern cannot change now.';
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
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
    } else if (input.type.kind === 'record') {
      Object.assign(errors, R.fileErrors(input.file ? { name: input.file.name, size: input.file.size } : null), R.summaryErrors(input.summary || ''));
      if (!input.expiresOn || input.expiresOn <= today()) errors.expiresOn = 'Enter an expiry date after today.';
    } else if (!(input.dueDay >= 1 && input.dueDay <= 28)) errors.dueDay = 'Due day must be 1 to 28.';
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const cs = await sumOf(input.file);
    const d: DocumentRow = { id: nextId++, number, title: input.title.trim(), project: input.project.code, type: input.type.code, kind: input.type.kind, folder: input.type.folder, owner: input.owner, removed: false, spName: `${number}.pdf`, dueDay: input.dueDay ?? null, startPeriod: input.startPeriod ?? null };
    docs.push(d);
    if (input.type.kind === 'controlled') revs.push({ id: nextId++, documentId: d.id, n: 0, status: 'Submitted', reason: input.reason, summary: input.summary.trim(), note: input.note.trim(), uploader: ME, checker: input.checker, approver: input.approver, checkedBy: '', approvedBy: '', returnNote: '', fileName: input.file.name, fileUrl: '#', checksum: cs, createdAt: today() });
    this.log('Created document', number, `${d.title}`);
    return d.id;
  }
  private rule(problem: string | null) { if (problem) throw new RuleError(problem); }
  async submitRevision(doc: DocumentRow, list: RevisionRow[], input: any) {
    const errors = R.revisionErrors({ uploader: ME, checker: input.checker, approver: input.approver, reason: input.reason, summary: input.summary, note: input.note, file: input.file ? { name: input.file.name, size: input.file.size } : null });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = list.length ? Math.max(...list.map(r => r.n)) + 1 : 0;
    const cs = await sumOf(input.file);
    revs.push({ id: nextId++, documentId: doc.id, n, status: 'Submitted', reason: input.reason, summary: input.summary.trim(), note: input.note.trim(), uploader: ME, checker: input.checker, approver: input.approver, checkedBy: '', approvedBy: '', returnNote: '', fileName: input.file.name, fileUrl: '#', checksum: cs, createdAt: today() });
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
    periods.push({ id: nextId++, documentId: doc.id, periodKey: key, version: 1, notNeeded: false, notNeededReason: '', summary: input.summary.trim(), uploader: ME, uploadedAt: stamp(), fileUrl: '#', replaceReason: '', checksum: cs });
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
    certs.push({ id: nextId++, documentId: doc.id, n: list.length, summary: input.summary.trim(), expiresOn: input.expiresOn, uploader: ME, fileName: input.file.name, fileUrl: '#', uploadedAt: stamp(), checksum: cs });
    this.log('Renewed certificate', doc.number, input.expiresOn);
  }
  async removeDocument(doc: DocumentRow, reason: string, text: string) {
    this.rule(R.canRemove(can('remove', doc.project, doc.folder)));
    const errors = R.removeErrors(reason, text);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    doc.removed = true; doc.spName = `DELETED_${today().replace(/-/g, '')}_${doc.number}.pdf`;
    this.log('Removed document', doc.number, `${reason}: ${text}. Renamed. Nothing erased.`);
    return doc.spName;
  }
  async restoreDocument(doc: DocumentRow) { this.rule(R.canRemove(can('remove', doc.project, doc.folder))); doc.removed = false; doc.spName = `${doc.number}.pdf`; this.log('Restored document', doc.number, 'Name set back.'); }
}
