/* SharePoint access for the Document Register. Every write runs the shared rules first.
   Lists are named as in SHAREPOINT_PLAN.md. Column internal names are listed in that plan. */
import { spfi, SPFI, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/files';
import '@pnp/sp/folders';
import '@pnp/sp/site-users/web';
import '@pnp/sp/site-groups/web';
import '@pnp/sp/behaviors/spfx';
import * as R from '../domain/rules';
import * as N from '../domain/numbering';
import type { ProjectInfo, DocTypeInfo, DocumentRow, RevisionRow, PeriodRow, CertRow, AuditRow } from '../domain/types';
import type { DocKind } from '../domain/rules';
import { safeFileName, odataString, nextVersion } from '../domain/sp';

export const LISTS = {
  projects: 'Projects', types: 'DocumentTypes', documents: 'Documents', revisions: 'Revisions',
  periods: 'PeriodEntries', certificates: 'CertificateVersions', audit: 'AuditLog',
} as const;
export const LIBRARY = 'Register Files';
export const GROUPS = { members: 'Register Members', records: 'Register Records Lead' } as const;

export class RuleError extends Error {
  fields: R.Errors;
  constructor(message: string, fields: R.Errors = {}) { super(message); this.fields = fields; }
}

export interface Me { name: string; isRecordsLead: boolean }

export class Register {
  private sp: SPFI;
  private siteUrl: string;
  private libraryPath: string;
  private me: Me | null = null;

  constructor(context: unknown, siteUrl: string) {
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.sp = spfi(this.siteUrl).using(SPFx(context as never));
    this.libraryPath = `${new URL(this.siteUrl).pathname.replace(/\/+$/, '')}/${LIBRARY}`;
  }

  /* ---------- who is signed in ---------- */
  async whoAmI(): Promise<Me> {
    if (this.me) return this.me;
    const u = await this.sp.web.currentUser();
    const groups = await this.sp.web.currentUser.groups();
    this.me = { name: u.Title, isRecordsLead: groups.some((g: { Title: string }) => g.Title === GROUPS.records) };
    return this.me;
  }
  /* Names of people in the register. Used for owner, checker and approver choices. */
  async members(): Promise<string[]> {
    try {
      const users = await this.sp.web.siteGroups.getByName(GROUPS.members).users();
      return users.map((u: { Title: string }) => u.Title).sort();
    } catch {
      return []; /* Not in the members group, or the group cannot be read. The register still opens. */
    }
  }

  /* ---------- reads ---------- */
  async projects(): Promise<ProjectInfo[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.projects).items
      .select('Title', 'ProjectName', 'ProjectStatus', 'NumberPattern').orderBy('Title').top(500)();
    return rows.map((r: any) => ({ code: r.Title, name: r.ProjectName, status: r.ProjectStatus === 'Archived' ? 'archived' : 'active', numberPattern: r.NumberPattern || R.DEFAULT_PATTERN }));
  }
  async projectTypes(project: string): Promise<DocTypeInfo[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.types).items
      .select('Title', 'TypeLabel', 'Kind', 'DefaultFolder').top(200)();
    const enabled = await this.sp.web.lists.getByTitle('ProjectTypes').items
      .select('TypeCode', 'Folder').filter(`ProjectCode eq ${odataString(project)}`).top(200)();
    const folderOf = new Map<string, string>(enabled.map((r: any) => [r.TypeCode, r.Folder]));
    return rows.filter((r: any) => folderOf.has(r.Title)).map((r: any) => ({ code: r.Title, label: r.TypeLabel, kind: r.Kind as DocKind, folder: folderOf.get(r.Title) as string }));
  }

  async documents(project?: string): Promise<DocumentRow[]> {
    const filter = project ? `ProjectCode eq ${odataString(project)}` : undefined;
    let q = this.sp.web.lists.getByTitle(LISTS.documents).items.select('Id', 'Title', 'DocNumber', 'ProjectCode', 'DocType', 'DocKind', 'Folder', 'Owner', 'IsRemoved', 'SharePointName', 'DueDay', 'StartPeriod').orderBy('DocNumber').top(5000);
    if (filter) q = q.filter(filter);
    const rows = await q();
    return rows.map(toDocument);
  }
  async allDocumentNumbers(): Promise<string[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.documents).items.select('DocNumber').top(5000)();
    return rows.map((r: any) => r.DocNumber);
  }
  async revisions(documentId: number): Promise<RevisionRow[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.revisions).items
      .filter(`DocumentId eq ${documentId}`).orderBy('RevNumber').top(500)();
    return rows.map(toRevision);
  }
  async periods(documentId: number): Promise<PeriodRow[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.periods).items
      .filter(`DocumentId eq ${documentId}`).orderBy('PeriodKey').top(5000)();
    return rows.map(toPeriod);
  }
  async certificates(documentId: number): Promise<CertRow[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.certificates).items
      .filter(`DocumentId eq ${documentId}`).orderBy('VersionNo').top(500)();
    return rows.map(toCert);
  }
  async audit(documentId?: number, limit = 200): Promise<AuditRow[]> {
    let q = this.sp.web.lists.getByTitle(LISTS.audit).items.select('Id', 'Title', 'WhoName', 'At', 'DocNumber', 'Detail').orderBy('Id', false).top(limit);
    if (documentId) q = q.filter(`DocumentId eq ${documentId}`);
    const rows = await q();
    return rows.map((r: any) => ({ id: r.Id, when: r.At, who: r.WhoName, action: r.Title, docNumber: r.DocNumber || '', detail: r.Detail || '' }));
  }

  /* ---------- writes ---------- */
  private async log(action: string, docNumber: string, detail: string, documentId?: number): Promise<void> {
    const me = await this.whoAmI();
    await this.sp.web.lists.getByTitle(LISTS.audit).items.add({
      Title: action, WhoName: me.name, At: new Date().toISOString(), DocNumber: docNumber, DocumentId: documentId ?? null, Detail: detail.slice(0, 900),
    });
  }
  private async upload(fileName: string, file: File): Promise<string> {
    const folder = this.sp.web.getFolderByServerRelativePath(this.libraryPath);
    const buffer = await file.arrayBuffer();
    const added = await folder.files.addUsingPath(safeFileName(fileName), buffer, { Overwrite: false });
    return added.ServerRelativeUrl;
  }

  async createDocument(input: {
    project: ProjectInfo; type: DocTypeInfo; title: string; owner: string;
    reason?: string; summary?: string; note?: string; checker?: string; approver?: string; file?: File | null;
    expiresOn?: string; dueDay?: number; startPeriod?: string;
  }): Promise<number> {
    const me = await this.whoAmI();
    const existing = await this.allDocumentNumbers();
    const number = N.nextNumber({ pattern: input.project.numberPattern, project: input.project.code, type: input.type.code, existing });
    const title = input.title.trim();
    const errors: R.Errors = {};
    if (!title) errors.title = 'Give it a title.';
    if (input.type.kind === 'periodic') {
      if (!(input.dueDay && input.dueDay >= 1 && input.dueDay <= 28)) errors.dueDay = 'Due day must be 1 to 28.';
      if (!input.startPeriod || input.startPeriod > R.monthKey()) errors.startPeriod = 'First month cannot be in the future.';
      if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
      const item = await this.sp.web.lists.getByTitle(LISTS.documents).items.add({
        Title: title, DocNumber: number, ProjectCode: input.project.code, DocType: input.type.code, DocKind: 'periodic', Folder: input.type.folder,
        Owner: input.owner, IsRemoved: false, SharePointName: `${number}.pdf`, DueDay: input.dueDay, StartPeriod: input.startPeriod,
      });
      await this.log('Created recurring series', number, `${title} · due day ${input.dueDay} · from ${input.startPeriod}`, item.data.Id);
      return item.data.Id;
    }
    const file = input.file || null;
    Object.assign(errors, R.fileErrors(file ? { name: file.name, size: file.size } : null));
    Object.assign(errors, R.summaryErrors(input.summary || ''));
    if (input.type.kind === 'controlled') {
      Object.assign(errors, R.revisionErrors({ uploader: me.name, checker: input.checker || '', approver: input.approver || '', reason: input.reason || '',
        summary: input.summary || '', note: input.note || '', file: file ? { name: file.name, size: file.size } : null }));
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn || '') || (input.expiresOn || '') <= R.isoDay()) {
      errors.expiresOn = 'Enter an expiry date after today.';
    }
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);

    const url = await this.upload(`${number}_r0_${file!.name}`, file!);
    const item = await this.sp.web.lists.getByTitle(LISTS.documents).items.add({
      Title: title, DocNumber: number, ProjectCode: input.project.code, DocType: input.type.code, DocKind: input.type.kind,
      Folder: input.type.folder, Owner: input.owner, IsRemoved: false, SharePointName: `${number}.pdf`,
    });
    const id = item.data.Id as number;
    if (input.type.kind === 'controlled') {
      await this.sp.web.lists.getByTitle(LISTS.revisions).items.add({
        Title: `${number} rev 0`, DocumentId: id, RevNumber: 0, Status: 'Submitted', Reason: input.reason, Summary: input.summary!.trim(),
        Note: input.note!.trim(), Uploader: me.name, Checker: input.checker, Approver: input.approver, FileName: file!.name, FileUrl: url,
      });
      await this.log('Created document', number, `${title} · rev 0 waiting for ${input.checker}`, id);
    } else {
      await this.sp.web.lists.getByTitle(LISTS.certificates).items.add({
        Title: `${number} v0`, DocumentId: id, VersionNo: 0, Summary: input.summary!.trim(), ExpiresOn: input.expiresOn, Uploader: me.name,
        FileName: file!.name, FileUrl: url, UploadedAt: new Date().toISOString(),
      });
      await this.log('Created certificate', number, `${title} · expires ${input.expiresOn}`, id);
    }
    return id;
  }

  async submitRevision(doc: DocumentRow, revs: RevisionRow[], input: { reason: string; summary: string; note: string; checker: string; approver: string; file: File | null }): Promise<number> {
    const me = await this.whoAmI();
    const errors = R.revisionErrors({ uploader: me.name, checker: input.checker, approver: input.approver, reason: input.reason, summary: input.summary, note: input.note,
      file: input.file ? { name: input.file.name, size: input.file.size } : null });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = nextVersion(revs.map(r => r.n));
    const url = await this.upload(`${doc.number}_r${n}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.revisions).items.add({
      Title: `${doc.number} rev ${n}`, DocumentId: doc.id, RevNumber: n, Status: 'Submitted', Reason: input.reason, Summary: input.summary.trim(),
      Note: input.note.trim(), Uploader: me.name, Checker: input.checker, Approver: input.approver, FileName: input.file!.name, FileUrl: url,
    });
    await this.log('Added revision', doc.number, `rev ${n} · waiting for ${input.checker}`, doc.id);
    return n;
  }

  private async transition(rev: RevisionRow, doc: DocumentRow, check: (r: R.RevisionState, a: string) => string | null, patch: Record<string, unknown>, status: string, verb: string) {
    const me = await this.whoAmI();
    const problem = check({ status: rev.status as R.RevStatus, by: rev.uploader, checker: rev.checker, approver: rev.approver }, me.name);
    if (problem) throw new RuleError(problem);
    await this.sp.web.lists.getByTitle(LISTS.revisions).items.getById(rev.id).update({ Status: status, ...patch });
    await this.log(verb, doc.number, `rev ${rev.n} ${verb.toLowerCase()}${patch.ReturnNote ? ': ' + patch.ReturnNote : ''}`, doc.id);
  }
  async check(rev: RevisionRow, doc: DocumentRow): Promise<void> {
    const me = await this.whoAmI();
    return this.transition(rev, doc, R.canCheck, { CheckedBy: me.name }, 'Checked', 'Checked');
  }
  async approve(rev: RevisionRow, doc: DocumentRow): Promise<void> {
    const me = await this.whoAmI();
    return this.transition(rev, doc, R.canApprove, { ApprovedBy: me.name }, 'Approved', 'Approved');
  }
  sendBack(rev: RevisionRow, doc: DocumentRow, text: string) {
    if (text.trim().length < 10) throw new RuleError('Write at least 10 characters to say what must change.', { text: 'Write at least 10 characters.' });
    return this.transition(rev, doc, R.canReturn, { ReturnNote: text.trim() }, 'Returned', 'Returned');
  }

  async uploadPeriod(doc: DocumentRow, key: string, input: { file: File | null; summary: string; replaceReason: string }): Promise<void> {
    const me = await this.whoAmI();
    const denied = R.canUploadSeries(doc.owner, me.name, me.isRecordsLead);
    if (denied) throw new RuleError(denied);
    /* Work out replace and version from the list itself, not from the page. */
    const prior = (await this.periods(doc.id)).filter(p => p.periodKey === key);
    const existing = prior.some(p => !p.notNeeded);
    const version = nextVersion(prior.map(p => p.version));
    const errors = R.periodErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, summary: input.summary, replaceReason: input.replaceReason, existing });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const url = await this.upload(`${doc.number}_${key}_v${version}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.periods).items.add({
      Title: `${doc.number} ${key}`, DocumentId: doc.id, PeriodKey: key, Version: version, NotNeeded: false, Summary: input.summary.trim(),
      Uploader: me.name, UploadedAt: new Date().toISOString(), FileName: input.file!.name, FileUrl: url, ReplaceReason: input.replaceReason.trim() || null,
    });
    await this.log(existing ? 'Replaced period' : 'Uploaded period', doc.number, `${key}: ${input.summary.trim()}`, doc.id);
  }
  async markNotNeeded(doc: DocumentRow, key: string, reason: string): Promise<void> {
    const me = await this.whoAmI();
    const denied = R.canUploadSeries(doc.owner, me.name, me.isRecordsLead);
    if (denied) throw new RuleError(denied);
    const errors = R.naErrors(reason);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    await this.sp.web.lists.getByTitle(LISTS.periods).items.add({
      Title: `${doc.number} ${key}`, DocumentId: doc.id, PeriodKey: key, Version: 1, NotNeeded: true, NotNeededReason: reason.trim(), Uploader: me.name, UploadedAt: new Date().toISOString(),
    });
    await this.log('Marked not needed', doc.number, `${key}: ${reason.trim()}`, doc.id);
  }

  async renew(doc: DocumentRow, certs: CertRow[], input: { file: File | null; summary: string; expiresOn: string }): Promise<void> {
    const me = await this.whoAmI();
    const denied = R.canUploadSeries(doc.owner, me.name, me.isRecordsLead);
    if (denied) throw new RuleError(denied.replace('series', 'certificate'));
    const errors = R.renewalErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, summary: input.summary, expiresOn: input.expiresOn });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = nextVersion(certs.map(c => c.n));
    const url = await this.upload(`${doc.number}_v${n}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.certificates).items.add({
      Title: `${doc.number} v${n}`, DocumentId: doc.id, VersionNo: n, Summary: input.summary.trim(), ExpiresOn: input.expiresOn, Uploader: me.name,
      FileName: input.file!.name, FileUrl: url, UploadedAt: new Date().toISOString(),
    });
    await this.log('Renewed certificate', doc.number, `version ${n} · expires ${input.expiresOn}`, doc.id);
  }

  async removeDocument(doc: DocumentRow, reason: string, text: string): Promise<string> {
    const me = await this.whoAmI();
    const denied = R.canRemove(me.isRecordsLead);
    if (denied) throw new RuleError(denied);
    const errors = R.removeErrors(reason, text);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const name = `DELETED_${R.isoDay().replace(/-/g, '')}_${doc.number}.pdf`;
    await this.sp.web.lists.getByTitle(LISTS.documents).items.getById(doc.id).update({ IsRemoved: true, SharePointName: name });
    await this.log('Removed document', doc.number, `${reason}: ${text.trim()}. Renamed to ${name}. Nothing erased.`, doc.id);
    return name;
  }
  async restoreDocument(doc: DocumentRow): Promise<void> {
    const me = await this.whoAmI();
    if (!me.isRecordsLead) throw new RuleError('Only the Records Lead can restore a document.');
    await this.sp.web.lists.getByTitle(LISTS.documents).items.getById(doc.id).update({ IsRemoved: false, SharePointName: `${doc.number}.pdf` });
    await this.log('Restored document', doc.number, 'Name set back.', doc.id);
  }
}

/* ---------- row mapping ---------- */
function toDocument(r: any): DocumentRow {
  return { id: r.Id, number: r.DocNumber, title: r.Title, project: r.ProjectCode, type: r.DocType, kind: r.DocKind as DocumentRow['kind'], folder: r.Folder,
    owner: r.Owner, removed: !!r.IsRemoved, spName: r.SharePointName || r.DocNumber, dueDay: r.DueDay ?? null, startPeriod: r.StartPeriod ?? null };
}
function toRevision(r: any): RevisionRow {
  return { id: r.Id, documentId: r.DocumentId, n: r.RevNumber, status: r.Status, reason: r.Reason || '', summary: r.Summary || '', note: r.Note || '',
    uploader: r.Uploader || '', checker: r.Checker || '', approver: r.Approver || '', checkedBy: r.CheckedBy || '', approvedBy: r.ApprovedBy || '',
    returnNote: r.ReturnNote || '', fileName: r.FileName || '', fileUrl: r.FileUrl || '', createdAt: r.Created || '' };
}
function toPeriod(r: any): PeriodRow {
  return { id: r.Id, documentId: r.DocumentId, periodKey: r.PeriodKey, version: r.Version || 1, notNeeded: !!r.NotNeeded, notNeededReason: r.NotNeededReason || '',
    summary: r.Summary || '', uploader: r.Uploader || '', uploadedAt: r.UploadedAt || null, fileUrl: r.FileUrl || '', replaceReason: r.ReplaceReason || '' };
}
function toCert(r: any): CertRow {
  return { id: r.Id, documentId: r.DocumentId, n: r.VersionNo, summary: r.Summary || '', expiresOn: r.ExpiresOn, uploader: r.Uploader || '',
    fileName: r.FileName || '', fileUrl: r.FileUrl || '', uploadedAt: r.UploadedAt || '' };
}
