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
import { safeFileName, odataString, nextVersion } from '../domain/sp';
import { sha256Hex } from '../domain/sha';
import { buildDashboard } from '../domain/dashboard';
import * as SU from '../domain/setup';
import * as P from '../domain/permissions';
import * as DR from '../domain/drafts';
import * as TR from '../domain/transmittal';
import * as MAIL from '../domain/mail';
import * as CT from '../domain/contacts';
import * as CS from '../domain/selection';
import { textPdf } from '../domain/pdf';
import * as RT from '../domain/retention';
import * as TREE from '../domain/tree';

export const LISTS = {
  projects: 'Projects', projectTypes: 'ProjectTypes', projectFolders: 'ProjectFolders', templates: 'Templates',
  documents: 'Documents', revisions: 'Revisions', periods: 'PeriodEntries', certificates: 'CertificateVersions', audit: 'AuditLog', grants: 'Permissions', drafts: 'Drafts', transmittals: 'Transmittals', contacts: 'Contacts',
} as const;
export const LIBRARY = 'Register Files';
export const GROUPS = { members: 'Register Members', records: 'Register Records Lead' } as const;

export class RuleError extends Error {
  fields: R.Errors;
  constructor(message: string, fields: R.Errors = {}) { super(message); this.fields = fields; }
}

export type Me = P.Me;

export class Register {
  private sp: SPFI;
  private context: any;
  private siteUrl: string;
  private libraryPath: string;
  private me: Me | null = null;

  constructor(context: unknown, siteUrl: string) {
    this.context = context;
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.sp = spfi(this.siteUrl).using(SPFx(context as never));
    this.libraryPath = `${new URL(this.siteUrl).pathname.replace(/\/+$/, '')}/${LIBRARY}`;
  }

  /* ---------- who is signed in ---------- */
  async whoAmI(): Promise<Me> {
    if (this.me) return this.me;
    const u = await this.sp.web.currentUser();
    const groups = await this.sp.web.currentUser.groups();
    const stored = await this.grants();
    const inRecords = groups.some((g: { Title: string }) => g.Title === GROUPS.records);
    /* Until grants exist, the Records Lead group works as admin. Once grants exist, only grants count. */
    this.me = { name: u.Title, grants: [...stored, ...P.bootstrapGrants(inRecords ? [u.Title] : [], stored.length > 0)] };
    return this.me;
  }

  /* ---------- who can do what ---------- */
  async grants(): Promise<P.Grant[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.grants).items.select('Id', 'Title', 'ProjectCode', 'FolderPath', 'Capability', 'IsRemoved').top(5000)();
    return rows.filter((r: any) => !r.IsRemoved).map((r: any) => ({ id: r.Id, user: r.Title, project: r.ProjectCode || P.ALL_PROJECTS, folder: r.FolderPath || '', cap: r.Capability as P.Cap }));
  }
  async addGrant(input: { user: string; project: string; folder: string; cap: P.Cap }): Promise<void> {
    const me = await this.whoAmI();
    requireCap(me, 'permissions', P.ALL_PROJECTS, '', 'manage permissions');
    const existing = await this.grants();
    const problem = P.grantErrors(input, existing);
    if (problem) throw new RuleError(problem);
    await this.sp.web.lists.getByTitle(LISTS.grants).items.add({ Title: input.user, ProjectCode: input.project, FolderPath: input.folder, Capability: input.cap });
    await this.log('Granted permission', '', `${input.user} · ${P.CAP_LABEL[input.cap]} · ${input.project === P.ALL_PROJECTS ? 'all projects' : input.project}${input.folder ? ' / ' + input.folder : ''}`);
  }
  async removeGrant(g: P.Grant): Promise<void> {
    const me = await this.whoAmI();
    requireCap(me, 'permissions', P.ALL_PROJECTS, '', 'manage permissions');
    if (g.cap === 'permissions' && (await this.grants()).filter(x => x.cap === 'permissions' && x.project === P.ALL_PROJECTS).length <= 1) {
      throw new RuleError('Keep at least one admin. Add another admin before removing this one.');
    }
    /* Never deleted. Marked as removed, so the history stays. */
    await this.sp.web.lists.getByTitle(LISTS.grants).items.getById(g.id).update({ IsRemoved: true });
    await this.log('Revoked permission', '', `${g.user} · ${P.CAP_LABEL[g.cap]} · ${g.project === P.ALL_PROJECTS ? 'all projects' : g.project}${g.folder ? ' / ' + g.folder : ''}`);
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
      .select('Title', 'ProjectName', 'ProjectStatus', 'NumberPattern', 'ProjectKind', 'ProjectOwner').orderBy('Title').top(500)();
    return rows.map((r: any) => ({ code: r.Title, name: r.ProjectName, status: r.ProjectStatus === 'Archived' ? 'archived' : 'active', numberPattern: r.NumberPattern || R.DEFAULT_PATTERN,
      kind: r.ProjectKind === 'Internal' ? 'internal' : 'standard', owner: r.ProjectOwner || '' }));
  }
  /* Document types on for this project, with their folder and first number. Labels and kinds come from the code library. */
  async projectTypes(project: string): Promise<DocTypeInfo[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.projectTypes).items
      .select('TypeCode', 'Folder', 'FirstNumber').filter(`ProjectCode eq ${odataString(project)}`).top(200)();
    return rows.map((r: any) => {
      const def = SU.typeDef(r.TypeCode);
      return def ? { code: def.code, label: def.label, kind: def.kind, folder: r.Folder, firstNumber: r.FirstNumber || 1 } : null;
    }).filter((x: DocTypeInfo | null): x is DocTypeInfo => x !== null);
  }

  /* ---------- project setup ---------- */

  /* Full setup of one project, for the setup form. */
  async projectSetup(code: string): Promise<{ setup: SU.ProjectSetup; locked: boolean; docsInFolder: Record<string, number>; docsOfType: Record<string, number> }> {
    const p = (await this.sp.web.lists.getByTitle(LISTS.projects).items.filter(`Title eq ${odataString(code)}`).top(1)())[0];
    if (!p) throw new RuleError(`${code} was not found.`);
    const frows = await this.sp.web.lists.getByTitle(LISTS.projectFolders).items.select('Title', 'IsRemoved').filter(`ProjectCode eq ${odataString(code)}`).top(500)();
    const folders = frows.filter((r: any) => !r.IsRemoved).map((r: any) => r.Title as string);
    const removedFolders = frows.filter((r: any) => r.IsRemoved).map((r: any) => r.Title as string);
    const trows = await this.sp.web.lists.getByTitle(LISTS.projectTypes).items.select('TypeCode', 'Folder', 'FirstNumber', 'Enabled').filter(`ProjectCode eq ${odataString(code)}`).top(200)();
    /* Every type in the library, with its on/off state for this project. Off types keep their row. */
    const types = SU.DOC_TYPES.map(d => {
      const r = trows.find((x: any) => x.TypeCode === d.code);
      return { code: d.code, enabled: !!r && r.Enabled !== false, folder: r?.Folder || d.folder, firstNumber: r?.FirstNumber || 1 };
    });
    const docs = await this.documents(code);
    const docsInFolder: Record<string, number> = {};
    const docsOfType: Record<string, number> = {};
    for (const d of docs) {
      docsOfType[d.type] = (docsOfType[d.type] || 0) + 1;
      for (const f of folders) if (d.folder === f || d.folder.startsWith(f + '/')) docsInFolder[f] = (docsInFolder[f] || 0) + 1;
    }
    return {
      setup: { code, name: p.ProjectName, status: p.ProjectStatus === 'Archived' ? 'archived' : 'active', numberPattern: p.NumberPattern || R.DEFAULT_PATTERN, folders, types, removedFolders,
        kind: p.ProjectKind === 'Internal' ? 'internal' : 'standard', owner: p.ProjectOwner || '' },
      locked: docs.length > 0, docsInFolder, docsOfType,
    };
  }
  async createProject(setup: SU.ProjectSetup): Promise<string> {
    const me = await this.whoAmI();
    const kind = setup.kind || 'standard';
    if (!P.canCreateProject(me, kind)) throw new RuleError('You do not have permission to add a standard project. Ask an admin, or create an internal project.');
    const code = setup.code.trim().toUpperCase();
    const existing = (await this.projects()).map(p => p.code);
    const errors = SU.projectSetupErrors({ ...setup, code }, true, existing);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    await this.sp.web.lists.getByTitle(LISTS.projects).items.add({
      Title: code, ProjectName: setup.name.trim(), ProjectStatus: 'Active', NumberPattern: setup.numberPattern.trim(),
      ProjectKind: kind === 'internal' ? 'Internal' : 'Standard', ProjectOwner: me.name,
    });
    for (const f of setup.folders) await this.sp.web.lists.getByTitle(LISTS.projectFolders).items.add({ Title: f, ProjectCode: code });
    for (const t of setup.types.filter(x => x.enabled)) {
      await this.sp.web.lists.getByTitle(LISTS.projectTypes).items.add({ Title: `${code} ${t.code}`, ProjectCode: code, TypeCode: t.code, Folder: t.folder, FirstNumber: t.firstNumber });
    }
    await this.log('Created project', '', `${code} · ${setup.name.trim()} · ${setup.folders.length} folders · ${setup.types.filter(x => x.enabled).length} document types`);
    return code;
  }
  async updateProject(setup: SU.ProjectSetup, before: { setup: SU.ProjectSetup; docsInFolder: Record<string, number>; docsOfType: Record<string, number>; locked: boolean }, renames: TREE.Rename[] = []): Promise<number> {
    const me = await this.whoAmI();
    const ref = { code: setup.code, kind: before.setup.kind || 'standard', owner: before.setup.owner || '' } as P.ProjectRef;
    if (!P.canManageProject(me, ref)) throw new RuleError('You do not have permission to change this project. Ask an admin.');
    const errors = SU.projectSetupErrors(setup, false, []);
    const cur = before.setup;
    for (const f of cur.folders) {
      const now = TREE.applyRenames(f, renames); // a renamed folder is not a removed one
      if (!setup.folders.includes(now) && (before.docsInFolder[f] || 0) > 0) errors[`folder:${f}`] = `${before.docsInFolder[f]} document(s) are filed here. Move them first.`;
    }
    for (const t of cur.types) {
      const still = setup.types.find(x => x.code === t.code && x.enabled);
      if (!still && (before.docsOfType[t.code] || 0) > 0) errors[`type:${t.code}`] = `${before.docsOfType[t.code]} document(s) of this type exist. It cannot be turned off.`;
      if (still && (before.docsOfType[t.code] || 0) > 0 && still.firstNumber !== t.firstNumber) errors[`first:${t.code}`] = 'Numbering has started. The first number cannot change now.';
    }
    if (before.locked && setup.numberPattern !== cur.numberPattern) errors.numberPattern = 'Numbering has started. The pattern cannot change now.';
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);

    const code = cur.code;
    const plist = this.sp.web.lists.getByTitle(LISTS.projects);
    const pItem = (await plist.items.filter(`Title eq ${odataString(code)}`).top(1)())[0];
    await plist.items.getById(pItem.Id).update({ ProjectName: setup.name.trim(), ProjectStatus: setup.status === 'archived' ? 'Archived' : 'Active', NumberPattern: setup.numberPattern.trim() });

    /* Folders: never deleted. Each one is active or removed, and its row says which. */
    const flist = this.sp.web.lists.getByTitle(LISTS.projectFolders);
    const fRows = await flist.items.select('Id', 'Title', 'IsRemoved').filter(`ProjectCode eq ${odataString(code)}`).top(500)();
    const removedList = (setup.removedFolders || []).filter(f => !setup.folders.includes(f));
    const wanted: Array<[string, boolean]> = [...setup.folders.map(f => [f, false] as [string, boolean]), ...removedList.map(f => [f, true] as [string, boolean])];
    for (const [title, removed] of wanted) {
      const row = fRows.find((r: any) => r.Title === title);
      if (!row) await flist.items.add({ Title: title, ProjectCode: code, IsRemoved: removed });
      else if (!!row.IsRemoved !== removed) await flist.items.getById(row.Id).update({ IsRemoved: removed });
    }
    for (const r of fRows) if (!wanted.some(([t]) => t === r.Title)) await flist.items.getById(r.Id).update({ IsRemoved: true });

    /* Renamed folders: move the documents filed in them, and log it. Numbers never change. */
    if (renames.length) {
      const docs = await this.documents(code);
      for (const d of docs) {
        const to = TREE.applyRenames(d.folder, renames);
        if (to === d.folder) continue;
        await this.sp.web.lists.getByTitle(LISTS.documents).items.getById(d.id).update({ Folder: to });
        await this.log('Moved to renamed folder', d.number, `${d.folder} → ${to}`, d.id);
      }
      for (const r of renames) await this.log('Renamed folder', '', `${r.from} → ${r.to}`);
    }

    const tlist = this.sp.web.lists.getByTitle(LISTS.projectTypes);
    /* Types: turned off by Enabled = false, never deleted. */
    const tRows = await tlist.items.select('Id', 'TypeCode', 'Enabled').filter(`ProjectCode eq ${odataString(code)}`).top(200)();
    for (const t of setup.types) {
      const row = tRows.find((r: any) => r.TypeCode === t.code);
      if (!row && !t.enabled) continue;
      if (row) await tlist.items.getById(row.Id).update({ Enabled: t.enabled, Folder: t.folder, FirstNumber: t.firstNumber });
      else await tlist.items.add({ Title: `${code} ${t.code}`, ProjectCode: code, TypeCode: t.code, Folder: t.folder, FirstNumber: t.firstNumber, Enabled: true });
    }
    const changes = [cur.name !== setup.name.trim() ? 'name' : '', cur.numberPattern !== setup.numberPattern ? 'numbering' : '',
      cur.status !== setup.status ? `status ${setup.status}` : ''].filter(Boolean);
    const addedF = setup.folders.filter(f => !cur.folders.includes(f)), removedF = cur.folders.filter(f => !setup.folders.includes(f));
    if (addedF.length) changes.push(`folders added: ${addedF.join(', ')}`);
    if (removedF.length) changes.push(`folders removed (kept, marked removed): ${removedF.join(', ')}`);
    await this.log('Changed project', '', `${code}: ${changes.join(' · ') || 'no changes'}`);
    return changes.length;
  }

  /* Templates: built-in from code, saved ones from the Templates list. */
  async templates(): Promise<SU.TemplateDef[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.templates).items.select('Id', 'Title', 'Description', 'Body').orderBy('Title').top(200)();
    const saved = rows.map((r: any): SU.TemplateDef => {
      const body = JSON.parse(r.Body);
      return { id: `saved-${r.Id}`, name: r.Title, description: r.Description || '', numberPattern: body.numberPattern, folders: body.folders, types: body.types, builtIn: false };
    });
    return [...SU.BUILT_IN_TEMPLATES, ...saved];
  }
  async saveTemplate(name: string, description: string, setup: SU.ProjectSetup): Promise<void> {
    const me = await this.whoAmI();
    requireCap(me, 'projects', P.ALL_PROJECTS, '', 'save a template');
    const clean = name.trim();
    if (!clean) throw new RuleError('Give the template a name.', { name: 'Give the template a name.' });
    if (SU.BUILT_IN_TEMPLATES.some(t => t.name === clean)) throw new RuleError('That name is used by a built-in template.', { name: 'That name is used by a built-in template.' });
    const dup = await this.sp.web.lists.getByTitle(LISTS.templates).items.filter(`Title eq ${odataString(clean)}`).top(1)();
    if (dup.length) throw new RuleError('A template with this name already exists.', { name: 'A template with this name already exists.' });
    const body = JSON.stringify({ numberPattern: setup.numberPattern, folders: setup.folders, types: setup.types.filter(t => t.enabled).map(t => ({ code: t.code, enabled: true, folder: t.folder, firstNumber: 1 })) });
    await this.sp.web.lists.getByTitle(LISTS.templates).items.add({ Title: clean, Description: description.trim(), Body: body });
    await this.log('Saved template', '', `${clean} from ${setup.code}`);
  }
  /* Read a folder CSV and check it. Nothing is saved. */
  previewFolderCsv(text: string): SU.CsvResult {
    return SU.readFolderCsv(text);
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
  /* Uploads the file and returns its link and SHA-256 checksum, computed from the bytes sent. */
  private async upload(fileName: string, file: File): Promise<{ url: string; checksum: string }> {
    const folder = this.sp.web.getFolderByServerRelativePath(this.libraryPath);
    const buffer = await file.arrayBuffer();
    const checksum = await sha256Hex(buffer);
    const added = await folder.files.addUsingPath(safeFileName(fileName), buffer, { Overwrite: false });
    return { url: added.ServerRelativeUrl, checksum };
  }

  async createDocument(input: {
    project: ProjectInfo; type: DocTypeInfo; title: string; owner: string;
    reason?: string; summary?: string; note?: string; checker?: string; approver?: string; file?: File | null;
    expiresOn?: string; dueDay?: number; startPeriod?: string;
  }): Promise<number> {
    const me = await this.whoAmI();
    const existing = await this.allDocumentNumbers();
    const number = N.nextNumber({ pattern: input.project.numberPattern, project: input.project.code, type: input.type.code, existing, firstNumber: input.type.firstNumber });
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
    } else if (input.type.kind === 'record' && (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn || '') || (input.expiresOn || '') <= R.isoDay())) {
      errors.expiresOn = 'Enter an expiry date after today.';
    }
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);

    const up = await this.upload(`${number}_r0_${file!.name}`, file!);
    const item = await this.sp.web.lists.getByTitle(LISTS.documents).items.add({
      Title: title, DocNumber: number, ProjectCode: input.project.code, DocType: input.type.code, DocKind: input.type.kind,
      Folder: input.type.folder, Owner: input.owner, IsRemoved: false, SharePointName: `${number}.pdf`,
    });
    const id = item.data.Id as number;
    if (input.type.kind === 'controlled') {
      await this.sp.web.lists.getByTitle(LISTS.revisions).items.add({
        Title: `${number} rev 0`, DocumentId: id, RevNumber: 0, Status: 'Submitted', Reason: input.reason, Summary: input.summary!.trim(),
        Note: input.note!.trim(), Uploader: me.name, Checker: input.checker, Approver: input.approver, FileName: file!.name, FileUrl: up.url, Checksum: up.checksum,
      });
      await this.log('Created document', number, `${title} · rev 0 waiting for ${input.checker}`, id);
    } else if (input.type.kind === 'working') {
      await this.sp.web.lists.getByTitle(LISTS.revisions).items.add({
        Title: `${number} v0`, DocumentId: id, RevNumber: 0, Status: 'Working', Summary: input.summary!.trim(), Uploader: me.name,
        FileName: file!.name, FileUrl: up.url, Checksum: up.checksum,
      });
      await this.log('Created uncontrolled document', number, `${title} · no check or approval`, id);
    } else {
      await this.sp.web.lists.getByTitle(LISTS.certificates).items.add({
        Title: `${number} v0`, DocumentId: id, VersionNo: 0, Summary: input.summary!.trim(), ExpiresOn: input.expiresOn, Uploader: me.name,
        FileName: file!.name, FileUrl: up.url, Checksum: up.checksum, UploadedAt: new Date().toISOString(),
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
    const up = await this.upload(`${doc.number}_r${n}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.revisions).items.add({
      Title: `${doc.number} rev ${n}`, DocumentId: doc.id, RevNumber: n, Status: 'Submitted', Reason: input.reason, Summary: input.summary.trim(),
      Note: input.note.trim(), Uploader: me.name, Checker: input.checker, Approver: input.approver, FileName: input.file!.name, FileUrl: up.url, Checksum: up.checksum,
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
    const denied = R.canUploadSeries(doc.owner, me.name, P.can(me, 'edit_any', doc.project, doc.folder));
    if (denied) throw new RuleError(denied);
    /* Work out replace and version from the list itself, not from the page. */
    const prior = (await this.periods(doc.id)).filter(p => p.periodKey === key);
    const existing = prior.some(p => !p.notNeeded);
    const version = nextVersion(prior.map(p => p.version));
    const errors = R.periodErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, summary: input.summary, replaceReason: input.replaceReason, existing });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const up = await this.upload(`${doc.number}_${key}_v${version}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.periods).items.add({
      Title: `${doc.number} ${key}`, DocumentId: doc.id, PeriodKey: key, Version: version, NotNeeded: false, Summary: input.summary.trim(),
      Uploader: me.name, UploadedAt: new Date().toISOString(), FileName: input.file!.name, FileUrl: up.url, Checksum: up.checksum, ReplaceReason: input.replaceReason.trim() || null,
    });
    await this.log(existing ? 'Replaced period' : 'Uploaded period', doc.number, `${key}: ${input.summary.trim()}`, doc.id);
  }
  async markNotNeeded(doc: DocumentRow, key: string, reason: string): Promise<void> {
    const me = await this.whoAmI();
    const denied = R.canUploadSeries(doc.owner, me.name, P.can(me, 'edit_any', doc.project, doc.folder));
    if (denied) throw new RuleError(denied);
    const errors = R.naErrors(reason);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    await this.sp.web.lists.getByTitle(LISTS.periods).items.add({
      Title: `${doc.number} ${key}`, DocumentId: doc.id, PeriodKey: key, Version: 1, NotNeeded: true, NotNeededReason: reason.trim(), Uploader: me.name, UploadedAt: new Date().toISOString(),
    });
    await this.log('Marked not needed', doc.number, `${key}: ${reason.trim()}`, doc.id);
  }

  /* ---------- plan: calendar and master list ---------- */
  /* Everything the plan views need for one project, read once. */
  async planData(project: string) {
    const setup = await this.projectSetup(project);
    const docs = await this.documents(project);
    const rows = await Promise.all(docs.map(async d => ({ revs: await this.revisions(d.id), periods: await this.periods(d.id), certs: await this.certificates(d.id) })));
    return { folders: setup.setup.folders, docs, revs: rows.flatMap(x => x.revs), periods: rows.flatMap(x => x.periods), certs: rows.flatMap(x => x.certs) };
  }

  /* ---------- uncontrolled documents ---------- */
  /* A new version of an uncontrolled document. No check, no approval. The owner, or anyone who can edit any document, uploads. */
  async uploadWorking(doc: DocumentRow, revs: RevisionRow[], input: { file: File | null; summary: string }): Promise<void> {
    const me = await this.whoAmI();
    const denied = R.canUploadSeries(doc.owner, me.name, P.can(me, 'edit_any', doc.project, doc.folder));
    if (denied) throw new RuleError(denied);
    const errors = { ...R.fileErrors(input.file ? { name: input.file.name, size: input.file.size } : null), ...R.summaryErrors(input.summary) };
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = nextVersion(revs.map(r => r.n));
    const up = await this.upload(`${doc.number}_v${n}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.revisions).items.add({
      Title: `${doc.number} v${n}`, DocumentId: doc.id, RevNumber: n, Status: 'Working', Summary: input.summary.trim(), Uploader: me.name,
      FileName: input.file!.name, FileUrl: up.url, Checksum: up.checksum,
    });
    await this.log('Uploaded new version', doc.number, `v${n} · no check or approval`, doc.id);
  }

  /* ---------- transmittals ---------- */
  async transmittals(project: string): Promise<TR.TransmittalRow[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.transmittals).items
      .select('Id', 'Title', 'ProjectCode', 'ToName', 'ToEmail', 'Purpose', 'Notes', 'LinesJson', 'FileUrl', 'Checksum', 'PdfUrl', 'PdfChecksum',
        'IssuedDate', 'IssuedBy', 'Status', 'HeldAt', 'SentAt')
      .filter(`ProjectCode eq ${odataString(project)}`).orderBy('Id', false).top(500)();
    return rows.map((r: any) => ({ id: r.Id, number: r.Title, project: r.ProjectCode, to: r.ToName || '', toEmail: r.ToEmail || '', date: r.IssuedDate || '',
      purpose: r.Purpose || '', notes: r.Notes || '', lines: JSON.parse(r.LinesJson || '[]'), fileUrl: r.FileUrl || '', checksum: r.Checksum || '',
      pdfUrl: r.PdfUrl || '', pdfChecksum: r.PdfChecksum || '', issuedBy: r.IssuedBy || '', status: (r.Status || 'Recorded') as TR.TransmittalRow['status'],
      heldAt: r.HeldAt || '', sentAt: r.SentAt || '' }));
  }
  /* Records the transmittal: list file and PDF copy saved in the library, audit entry written. If it is to be emailed,
     it is held for the undo window. Nothing is sent here. Nothing is deleted. */
  async issueTransmittal(input: { project: string; to: string; toEmails: string[]; purpose: string; notes: string; lines: TR.TransmittalLine[]; send: boolean; ack?: boolean }): Promise<string> {
    const me = await this.whoAmI();
    if (!input.to.trim()) throw new RuleError('Say who it is for.', { to: 'Say who it is for.' });
    if (!input.purpose.trim()) throw new RuleError('Say why it is sent.', { purpose: 'Say why it is sent.' });
    if (!input.lines.length) throw new RuleError('Choose at least one document.');
    const over = CS.overLimit(input.lines.length);
    if (over) throw new RuleError(over);
    if (input.lines.some(l => l.status && l.status !== 'current') && !input.ack) throw new RuleError('Some files are not the current version. Confirm that they should go out.', { ack: 'Confirm the files that are not current.' });
    if (input.send && (!input.toEmails.length || input.toEmails.some(e => !MAIL.validEmail(e)))) throw new RuleError('Choose at least one recipient with a valid email address.');
    const existing = (await this.transmittals(input.project)).map(t => t.number);
    const number = TR.nextTransmittalNumber(input.project, existing);
    const date = R.isoDay();
    const now = new Date().toISOString();
    const base = { number, to: input.to.trim(), toEmail: input.toEmails.join('; '), date, purpose: input.purpose.trim(), notes: input.notes.trim(), issuedBy: me.name, lines: input.lines, status: input.send ? 'Held' : 'Recorded', sentAt: '' };
    const csv = TR.transmittalCsv({ to: base.to, date, purpose: base.purpose, notes: base.notes, lines: input.lines });
    const up = await this.upload(`${number}.csv`, new File(['﻿' + csv], `${number}.csv`, { type: 'text/csv' }));
    const pdfBytes = textPdf(`Transmittal ${number}`, TR.transmittalPdfLines(base));
    const pdfFile = new File([pdfBytes], `${number}.pdf`, { type: 'application/pdf' });
    const pdf = await this.upload(`${number}.pdf`, pdfFile);
    await this.sp.web.lists.getByTitle(LISTS.transmittals).items.add({
      Title: number, ProjectCode: input.project, ToName: base.to, ToEmail: base.toEmail, Purpose: base.purpose, Notes: base.notes,
      LinesJson: JSON.stringify(input.lines), FileUrl: up.url, Checksum: up.checksum, PdfUrl: pdf.url, PdfChecksum: pdf.checksum,
      IssuedDate: date, IssuedBy: me.name, Status: base.status, HeldAt: input.send ? now : null,
    });
    await this.log(input.send ? 'Issued transmittal, held for undo' : 'Issued transmittal, not emailed', number,
      `${base.to}${base.toEmail ? ' <' + base.toEmail + '>' : ''} · ${base.purpose} · ${input.lines.length} document(s)`);
    return number;
  }
  /* Sends a held transmittal from the signed-in person's own mailbox (Microsoft Graph, delegated). Only the issuer may send. */
  async sendHeld(t: TR.TransmittalRow): Promise<void> {
    const me = await this.whoAmI();
    if (t.issuedBy !== me.name) throw new RuleError('Only the person who issued this transmittal can send it.');
    if (t.status !== 'Held') throw new RuleError(`This transmittal is ${t.status.toLowerCase()}. It cannot be sent.`);
    const mail = TR.emailDraft({ number: t.number, projectName: t.project, to: t.to, date: t.date, purpose: t.purpose, from: me.name, lines: t.lines });
    const csvText = '﻿' + TR.transmittalCsv({ to: t.to, date: t.date, purpose: t.purpose, notes: t.notes, lines: t.lines });
    const pdfBytes = textPdf(`Transmittal ${t.number}`, TR.transmittalPdfLines(t));
    const msg = MAIL.graphMessage({ to: t.toEmail.split(';').map(x => x.trim()).filter(Boolean), subject: mail.subject, body: mail.body, attachments: [
      { name: `${t.number}.csv`, contentType: 'text/csv', base64: toBase64(new TextEncoder().encode(csvText)) },
      { name: `${t.number}.pdf`, contentType: 'application/pdf', base64: toBase64(pdfBytes) },
    ] });
    const client = await this.graphClient();
    await client.api('/me/sendMail').post(msg);
    const now = new Date().toISOString();
    await this.sp.web.lists.getByTitle(LISTS.transmittals).items.getById(t.id).update({ Status: 'Sent', SentAt: now });
    await this.log('Sent transmittal by email', t.number, `to ${t.toEmail} from ${me.name}`);
  }
  /* Undo. Only inside the undo window and only for the issuer. The record is marked cancelled, not deleted. */
  async cancelHeld(t: TR.TransmittalRow): Promise<void> {
    const me = await this.whoAmI();
    if (t.issuedBy !== me.name) throw new RuleError('Only the person who issued this transmittal can undo it.');
    if (t.status !== 'Held') throw new RuleError(`This transmittal is ${t.status.toLowerCase()}. Nothing to undo.`);
    if (!MAIL.canUndo(t.heldAt, new Date().toISOString())) throw new RuleError('The undo time has passed. The email has gone.');
    await this.sp.web.lists.getByTitle(LISTS.transmittals).items.getById(t.id).update({ Status: 'Cancelled' });
    await this.log('Cancelled transmittal email (undo)', t.number, `to ${t.toEmail}. Record kept.`);
  }
  /* Mail goes out through the signed-in user's Microsoft 365 account. */
  private async graphClient(): Promise<any> {
    return this.context.msGraphClientFactory.getClient('3');
  }

  /* ---------- choosing files for a transmittal ---------- */
  /* One page of documents, by folder, number or title. Never loads the whole register. */
  async findDocuments(project: string, o: { folder?: string; text?: string; numbers?: string[]; skip: number; take: number }): Promise<{ docs: DocumentRow[]; more: boolean }> {
    let filter = `ProjectCode eq ${odataString(project)}`;
    if (o.folder) filter += ` and (Folder eq ${odataString(o.folder)} or startswith(Folder,${odataString(o.folder + '/')}))`;
    if (o.numbers && o.numbers.length) filter += ` and (${o.numbers.map(n => `DocNumber eq ${odataString(n)}`).join(' or ')})`;
    else if (o.text && o.text.trim()) { const t = odataString(o.text.trim()); filter += ` and (substringof(${t},DocNumber) or substringof(${t},Title))`; }
    const rows = await this.sp.web.lists.getByTitle(LISTS.documents).items
      .select('Id', 'Title', 'DocNumber', 'ProjectCode', 'DocType', 'DocKind', 'Folder', 'Owner', 'IsRemoved', 'SharePointName', 'DueDay', 'StartPeriod', 'LegalHold', 'HoldReason')
      .filter(filter).orderBy('DocNumber').skip(o.skip).top(o.take + 1)();
    return { docs: rows.slice(0, o.take).map(toDocument), more: rows.length > o.take };
  }
  /* Every stored file of these documents, each with its revision and status. Drafts are never included. */
  async filesFor(docs: DocumentRow[]): Promise<CS.CandidateFile[]> {
    const parts = await Promise.all(docs.map(async d => CS.candidatesOf(d,
      await this.revisions(d.id), await this.periods(d.id), await this.certificates(d.id))));
    return parts.flat();
  }

  /* ---------- recipients: companies and the people in them ---------- */
  async contacts(): Promise<CT.Contact[]> {
    const rows = await this.sp.web.lists.getByTitle(LISTS.contacts).items.select('Id', 'Title', 'Company', 'Email', 'IsRemoved').orderBy('Company').top(2000)();
    return rows.map((r: any) => ({ id: r.Id, company: r.Company || '', name: r.Title || '', email: r.Email || '', removed: !!r.IsRemoved }));
  }
  async addContact(input: { company: string; name: string; email: string }): Promise<void> {
    await this.whoAmI();
    const errors = CT.contactErrors(input, await this.contacts());
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    await this.sp.web.lists.getByTitle(LISTS.contacts).items.add({ Title: input.name.trim(), Company: input.company.trim(), Email: input.email.trim(), IsRemoved: false });
    await this.log('Added recipient', '', `${input.name.trim()} · ${input.company.trim()}`);
  }
  /* Never deleted. The person is marked removed and stops appearing in the list. */
  async removeContact(c: CT.Contact): Promise<void> {
    await this.whoAmI();
    await this.sp.web.lists.getByTitle(LISTS.contacts).items.getById(c.id).update({ IsRemoved: true });
    await this.log('Removed recipient', '', `${c.name} · ${c.company}. Kept, marked removed.`);
  }

  /* ---------- working drafts ---------- */
  /* Drafts the signed-in person may see. The list itself is readable by members, so the app filters. */
  async drafts(documentId: number): Promise<DR.DraftRow[]> {
    const me = await this.whoAmI();
    const rows = await this.sp.web.lists.getByTitle(LISTS.drafts).items
      .select('Id', 'DocumentId', 'Owner', 'Note', 'FileName', 'FileUrl', 'Checksum', 'Created', 'IsDiscarded')
      .filter(`DocumentId eq ${documentId}`).orderBy('Id', false).top(500)();
    const editAny = P.can(me, 'edit_any');
    return rows.map((r: any) => ({ id: r.Id, documentId: r.DocumentId, owner: r.Owner, note: r.Note || '', fileName: r.FileName || '',
      fileUrl: r.FileUrl || '', checksum: r.Checksum || '', createdAt: r.Created || '', discarded: !!r.IsDiscarded }))
      .filter((d: DR.DraftRow) => DR.canSeeDraft(d, me.name, editAny));
  }
  /* A draft is not a revision. Nothing is checked or approved. Filed as a separate working copy. */
  async addDraft(doc: DocumentRow, input: { file: File | null; note: string }): Promise<void> {
    const me = await this.whoAmI();
    const errors = DR.draftErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, note: input.note });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const up = await this.upload(`${doc.number}_DRAFT_${me.name}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.drafts).items.add({
      Title: `${doc.number} draft`, DocumentId: doc.id, Owner: me.name, Note: input.note.trim(), FileName: input.file!.name,
      FileUrl: up.url, Checksum: up.checksum, IsDiscarded: false,
    });
    await this.log('Added working draft', doc.number, `${me.name} · not a revision`, doc.id);
  }
  async discardDraft(doc: DocumentRow, d: DR.DraftRow): Promise<void> {
    const me = await this.whoAmI();
    const problem = DR.canDiscardDraft(d, me.name, P.can(me, 'edit_any'));
    if (problem) throw new RuleError(problem);
    await this.sp.web.lists.getByTitle(LISTS.drafts).items.getById(d.id).update({ IsDiscarded: true });
    await this.log('Discarded working draft', doc.number, `${d.owner}. Kept in the library.`, doc.id);
  }

  /* Dashboard numbers. Reads each document's history, so cost grows with the register. Fine for a pilot register. */
  async dashboard(me: Me, today: string) {
    const projects = await this.projects();
    const docs = await this.documents();
    const docRows = await Promise.all(docs.map(async d => ({ d, revs: await this.revisions(d.id), periods: await this.periods(d.id), certs: await this.certificates(d.id) })));
    return buildDashboard({
      me: me.name, today, projects, docs,
      revisions: docRows.flatMap(x => x.revs.map(r => ({ documentId: r.documentId, n: r.n, status: r.status, checker: r.checker, approver: r.approver, by: r.uploader }))),
      periods: docRows.flatMap(x => x.periods),
      certificates: docRows.flatMap(x => x.certs),
    });
  }

  async renew(doc: DocumentRow, certs: CertRow[], input: { file: File | null; summary: string; expiresOn: string }): Promise<void> {
    const me = await this.whoAmI();
    const denied = R.canUploadSeries(doc.owner, me.name, P.can(me, 'edit_any', doc.project, doc.folder));
    if (denied) throw new RuleError(denied.replace('series', 'certificate'));
    const errors = R.renewalErrors({ file: input.file ? { name: input.file.name, size: input.file.size } : null, summary: input.summary, expiresOn: input.expiresOn });
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const n = nextVersion(certs.map(c => c.n));
    const up = await this.upload(`${doc.number}_v${n}_${input.file!.name}`, input.file!);
    await this.sp.web.lists.getByTitle(LISTS.certificates).items.add({
      Title: `${doc.number} v${n}`, DocumentId: doc.id, VersionNo: n, Summary: input.summary.trim(), ExpiresOn: input.expiresOn, Uploader: me.name,
      FileName: input.file!.name, FileUrl: up.url, Checksum: up.checksum, UploadedAt: new Date().toISOString(),
    });
    await this.log('Renewed certificate', doc.number, `version ${n} · expires ${input.expiresOn}`, doc.id);
  }

  /* Latest date of any revision, upload or certificate. Retention counts from here. */
  async lastActivityOf(documentId: number): Promise<string> {
    const [revs, periods, certs] = await Promise.all([this.revisions(documentId), this.periods(documentId), this.certificates(documentId)]);
    return RT.lastActivity([...revs.map(r => r.createdAt), ...periods.map(p => p.uploadedAt), ...certs.map(c => c.uploadedAt)], R.isoDay());
  }
  /* Legal hold: blocks removal and renaming. Only someone who can remove may place or release it. */
  async setLegalHold(doc: DocumentRow, on: boolean, reason: string): Promise<void> {
    const me = await this.whoAmI();
    requireCap(me, 'remove', doc.project, doc.folder, on ? 'place a legal hold' : 'release a legal hold');
    const errors = RT.holdErrors(reason);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    await this.sp.web.lists.getByTitle(LISTS.documents).items.getById(doc.id).update({ LegalHold: on, HoldReason: on ? reason.trim() : '' });
    await this.log(on ? 'Legal hold placed' : 'Legal hold released', doc.number, `${reason.trim()}`, doc.id);
  }
  async removeDocument(doc: DocumentRow, reason: string, text: string): Promise<string> {
    const me = await this.whoAmI();
    const denied = R.canRemove(P.can(me, 'remove', doc.project, doc.folder));
    if (denied) throw new RuleError(denied);
    const errors = R.removeErrors(reason, text);
    if (Object.keys(errors).length) throw new RuleError('Please fix the highlighted fields.', errors);
    const last = await this.lastActivityOf(doc.id);
    const held = RT.removalBlock({ legalHold: doc.legalHold, lastActivityDay: last, today: R.isoDay() });
    if (held) throw new RuleError(held);
    const name = `DELETED_${R.isoDay().replace(/-/g, '')}_${doc.number}.pdf`;
    await this.sp.web.lists.getByTitle(LISTS.documents).items.getById(doc.id).update({ IsRemoved: true, SharePointName: name });
    await this.log('Removed document', doc.number, `${reason}: ${text.trim()}. Renamed to ${name}. Nothing erased.`, doc.id);
    return name;
  }
  async restoreDocument(doc: DocumentRow): Promise<void> {
    const me = await this.whoAmI();
    requireCap(me, 'remove', doc.project, doc.folder, 'restore a document');
    await this.sp.web.lists.getByTitle(LISTS.documents).items.getById(doc.id).update({ IsRemoved: false, SharePointName: `${doc.number}.pdf` });
    await this.log('Restored document', doc.number, 'Name set back.', doc.id);
  }
}

/* Base64 for mail attachments. */
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* Throws a plain message when the person lacks the permission. */
function requireCap(me: Me, cap: P.Cap, project: string, folder: string, what: string): void {
  if (!P.can(me, cap, project, folder)) throw new RuleError(`You do not have permission to ${what}. Ask an admin.`);
}

/* ---------- row mapping ---------- */
function toDocument(r: any): DocumentRow {
  return { id: r.Id, number: r.DocNumber, title: r.Title, project: r.ProjectCode, type: r.DocType, kind: r.DocKind as DocumentRow['kind'], folder: r.Folder,
    owner: r.Owner, removed: !!r.IsRemoved, spName: r.SharePointName || r.DocNumber, dueDay: r.DueDay ?? null, startPeriod: r.StartPeriod ?? null,
    legalHold: !!r.LegalHold, holdReason: r.HoldReason || '' };
}
function toRevision(r: any): RevisionRow {
  return { id: r.Id, documentId: r.DocumentId, n: r.RevNumber, status: r.Status, reason: r.Reason || '', summary: r.Summary || '', note: r.Note || '',
    uploader: r.Uploader || '', checker: r.Checker || '', approver: r.Approver || '', checkedBy: r.CheckedBy || '', approvedBy: r.ApprovedBy || '',
    returnNote: r.ReturnNote || '', fileName: r.FileName || '', fileUrl: r.FileUrl || '', checksum: r.Checksum || '', createdAt: r.Created || '' };
}
function toPeriod(r: any): PeriodRow {
  return { id: r.Id, documentId: r.DocumentId, periodKey: r.PeriodKey, version: r.Version || 1, notNeeded: !!r.NotNeeded, notNeededReason: r.NotNeededReason || '',
    summary: r.Summary || '', uploader: r.Uploader || '', uploadedAt: r.UploadedAt || null, fileUrl: r.FileUrl || '', replaceReason: r.ReplaceReason || '', checksum: r.Checksum || '', fileName: r.FileName || '' };
}
function toCert(r: any): CertRow {
  return { id: r.Id, documentId: r.DocumentId, n: r.VersionNo, summary: r.Summary || '', expiresOn: r.ExpiresOn, uploader: r.Uploader || '',
    fileName: r.FileName || '', fileUrl: r.FileUrl || '', uploadedAt: r.UploadedAt || '', checksum: r.Checksum || '' };
}
