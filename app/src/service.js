'use strict';
/* Every write goes through here. Rules are checked on the server, inside one transaction, with an audit entry. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const R = require('./rules');
const { tx } = require('./db');
const TEMPLATE = require('./template').TEMPLATE;

class AppError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}
const bad = (message, fields) => new AppError(400, message, fields);
const forbid = message => new AppError(403, message);
const notFound = what => new AppError(404, `${what} not found.`);

function createService({ db, filesDir, now = () => new Date() }) {
  fs.mkdirSync(filesDir, { recursive: true });
  const nowIso = () => now().toISOString();
  const today = () => R.isoDay(now());

  /* ---------- helpers ---------- */
  function audit(who, action, documentId, detail) {
    db.prepare('INSERT INTO audit (at, who, action, document_id, detail) VALUES (?,?,?,?,?)')
      .run(nowIso(), who, action, documentId ?? null, detail);
  }
  function storeFile(file) {
    const sha = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const target = path.join(filesDir, sha);
    if (!fs.existsSync(target)) fs.writeFileSync(target, file.buffer);
    return { sha256: sha, size: file.buffer.length, name: safeName(file.name) };
  }
  function safeName(name) {
    return String(name || 'file').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 200);
  }
  function actorRole(actor) {
    const u = db.prepare('SELECT role FROM users WHERE name = ?').get(actor);
    if (!u) throw forbid('Unknown user.');
    return u.role;
  }
  function docRow(id) {
    const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!d) throw notFound('Document');
    return d;
  }
  function revRow(id) {
    const r = db.prepare('SELECT * FROM revisions WHERE id = ?').get(id);
    if (!r) throw notFound('Revision');
    return r;
  }
  function typeInfo(code) {
    const t = db.prepare('SELECT * FROM types WHERE code = ?').get(code);
    if (!t) throw bad('Unknown document type.', { type: 'Choose a document type.' });
    return t;
  }
  function allNumbers() {
    return db.prepare('SELECT number FROM documents').all().map(r => r.number);
  }

  /* ---------- reads ---------- */
  function listDocuments({ project, cls, q, removed } = {}) {
    const rows = db.prepare(`SELECT d.*, t.label AS type_label FROM documents d JOIN types t ON t.code = d.type
      WHERE (? IS NULL OR d.project = ?) AND (? IS NULL OR d.cls = ?) AND (? = 1 OR d.deleted = 0)
      ORDER BY d.number`).all(project || null, project || null, cls || null, cls || null, removed ? 1 : 0);
    const needle = (q || '').trim().toLowerCase();
    return rows
      .filter(d => !needle || `${d.number} ${d.title} ${d.type_label} ${d.folder}`.toLowerCase().includes(needle))
      .map(d => summarize(d));
  }
  function summarize(d) {
    const base = { id: d.id, number: d.number, title: d.title, project: d.project, type: d.type, cls: d.cls, folder: d.folder, owner: d.owner, deleted: !!d.deleted, spName: d.sp_name };
    if (d.cls === 'controlled') {
      const revs = db.prepare('SELECT * FROM revisions WHERE document_id = ? ORDER BY n').all(d.id);
      const cur = [...revs].reverse().find(r => r.status === 'Approved') || null;
      base.current = cur ? cur.n : null;
      base.latest = revs.length ? { n: revs.at(-1).n, status: revs.at(-1).status } : null;
    } else if (d.cls === 'periodic') {
      const k = today().slice(0, 7);
      base.thisMonth = periodFor(d, k);
    } else {
      const v = db.prepare('SELECT * FROM certificate_versions WHERE document_id = ? ORDER BY n DESC LIMIT 1').get(d.id);
      base.expiresOn = v ? v.expires_on : null;
      base.status = v ? R.recordState(v.expires_on, today()).state : 'none';
    }
    return base;
  }
  function periodFor(d, key) {
    if (key < d.start_period) return { period: key, state: 'not_started' };
    const p = db.prepare('SELECT * FROM periods WHERE document_id = ? AND period = ? ORDER BY version DESC LIMIT 1').get(d.id, key);
    return { period: key, state: R.periodState({ periodKey: key, dueDay: d.due_day, uploadedAt: p && !p.na ? p.uploaded_at : null, na: !!(p && p.na), today: today() }), due: R.dueDate(key, d.due_day) };
  }
  function getDocument(id) {
    const d = docRow(id);
    const out = { ...summarize(d), revisions: [], periods: [], versions: [] };
    if (d.cls === 'controlled') {
      out.revisions = db.prepare('SELECT * FROM revisions WHERE document_id = ? ORDER BY n').all(d.id).map(revView);
    }
    if (d.cls === 'periodic') {
      const keys = [];
      for (let k = d.start_period; k <= today().slice(0, 7); k = R.addMonths(k, 1)) keys.push(k);
      out.periods = keys.map(k => {
        const p = db.prepare('SELECT * FROM periods WHERE document_id = ? AND period = ? ORDER BY version DESC LIMIT 1').get(d.id, k);
        const history = db.prepare('SELECT version, by, uploaded_at, replace_reason FROM periods WHERE document_id = ? AND period = ? ORDER BY version').all(d.id, k);
        return { ...periodFor(d, k), na: !!(p && p.na), naReason: p ? p.na_reason : null, by: p ? p.by : null, uploadedAt: p ? p.uploaded_at : null,
          summary: p && !p.na ? p.summary : null, fileName: p && !p.na ? p.file_name : null, history };
      }).reverse();
    }
    if (d.cls === 'record') {
      out.versions = db.prepare('SELECT * FROM certificate_versions WHERE document_id = ? ORDER BY n DESC').all(d.id)
        .map(v => ({ n: v.n, summary: v.summary, fileName: v.file_name, sha256: v.file_sha256, expiresOn: v.expires_on, by: v.by, uploadedAt: v.uploaded_at }));
    }
    return out;
  }
  function revView(r) {
    return { id: r.id, n: r.n, status: r.status, reason: r.reason, summary: r.summary, note: r.note, fileName: r.file_name, sha256: r.file_sha256,
      by: r.by, checker: r.checker, approver: r.approver, checkedBy: r.checked_by, approvedBy: r.approved_by, returnNote: r.return_note, createdAt: r.created_at };
  }
  function listProjects() {
    return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM documents d WHERE d.project = p.code) AS documents
      FROM projects p ORDER BY p.code`).all();
  }
  function getProject(code) {
    const p = db.prepare('SELECT * FROM projects WHERE code = ?').get(code);
    if (!p) throw notFound('Project');
    const folders = db.prepare('SELECT path FROM project_folders WHERE project = ? ORDER BY path').all(code).map(r => r.path);
    const docsIn = path => db.prepare(`SELECT COUNT(*) n FROM documents WHERE project = ? AND (folder = ? OR folder LIKE ?)`).get(code, path, path + '/%').n;
    const types = db.prepare(`SELECT t.code, t.label, t.cls, pt.folder, pt.first_number FROM types t
      LEFT JOIN project_types pt ON pt.type = t.code AND pt.project = ? ORDER BY t.code`).all(code).map(t => ({
      code: t.code, label: t.label, cls: t.cls, enabled: !!t.folder, folder: t.folder, firstNumber: t.first_number || 1,
      documents: db.prepare('SELECT COUNT(*) n FROM documents WHERE project = ? AND type = ?').get(code, t.code).n }));
    const anyDocs = db.prepare('SELECT COUNT(*) n FROM documents WHERE project = ?').get(code).n;
    return { code: p.code, name: p.name, status: p.status, locked: anyDocs > 0,
      folders: folders.map(path => ({ path, documents: docsIn(path) })), types };
  }
  function standardTemplate() {
    return { folders: TEMPLATE.folders, types: TEMPLATE.types.map(t => ({ ...t, enabled: true, firstNumber: 1 })) };
  }
  /* Create a project with its folders and document types. Admin only. Everything is checked first. */
  function createProject(actor, b) {
    const role = actorRole(actor);
    if (role !== 'admin') throw forbid('Only the records lead can add a project.');
    return tx(db, () => {
      const code = String(b.code || '').trim().toUpperCase();
      const name = String(b.name || '').trim();
      const folders = (b.folders || []).map(f => String(f).trim());
      const types = (b.types || []).map(t => ({ code: t.code, enabled: !!t.enabled, folder: t.folder, firstNumber: Number(t.firstNumber || 1) }));
      const existingCodes = db.prepare('SELECT code FROM projects').all().map(r => r.code);
      const errors = R.projectSetupErrors({ code, name, folders, types, isNew: true, existingCodes });
      for (const t of types.filter(x => x.enabled)) {
        if (!db.prepare('SELECT 1 FROM types WHERE code = ?').get(t.code)) errors[`type:${t.code}`] = 'Unknown document type.';
      }
      if (Object.keys(errors).length) throw bad('Please fix the highlighted fields.', errors);
      db.prepare('INSERT INTO projects (code, name, status, created_at, created_by) VALUES (?,?,?,?,?)').run(code, name, 'active', nowIso(), actor);
      for (const f of folders) db.prepare('INSERT INTO project_folders (project, path) VALUES (?,?)').run(code, f);
      for (const t of types.filter(x => x.enabled)) {
        db.prepare('INSERT INTO project_types (project, type, folder, first_number) VALUES (?,?,?,?)').run(code, t.code, t.folder, t.firstNumber);
      }
      audit(actor, 'Created project', null, `${code} · ${name} · ${folders.length} folders · ${types.filter(x => x.enabled).length} document types`);
      return code;
    });
  }
  /* Change a project's setup. Anything that would orphan a document is refused. */
  function updateProject(actor, code, b) {
    const role = actorRole(actor);
    if (role !== 'admin') throw forbid('Only the records lead can change a project.');
    return tx(db, () => {
      const cur = db.prepare('SELECT * FROM projects WHERE code = ?').get(code);
      if (!cur) throw notFound('Project');
      const name = String(b.name == null ? cur.name : b.name).trim();
      const status = b.status || cur.status;
      const folders = (b.folders || []).map(f => String(f).trim());
      const types = (b.types || []).map(t => ({ code: t.code, enabled: !!t.enabled, folder: t.folder, firstNumber: Number(t.firstNumber || 1) }));
      const errors = R.projectSetupErrors({ code, name, folders, types, isNew: false });
      if (!['active', 'archived'].includes(status)) errors.status = 'Status must be active or archived.';
      const curFolders = db.prepare('SELECT path FROM project_folders WHERE project = ?').all(code).map(r => r.path);
      const curTypes = db.prepare('SELECT * FROM project_types WHERE project = ?').all(code);
      const docsIn = path => db.prepare('SELECT COUNT(*) n FROM documents WHERE project = ? AND (folder = ? OR folder LIKE ?)').get(code, path, path + '/%').n;
      for (const f of curFolders.filter(f => !folders.includes(f))) {
        const n = docsIn(f);
        if (n > 0) errors[`folder:${f}`] = `${n} document(s) are filed here. Move them first, then remove the folder.`;
      }
      for (const t of curTypes.filter(x => !types.find(y => y.code === x.type && y.enabled))) {
        const n = db.prepare('SELECT COUNT(*) n FROM documents WHERE project = ? AND type = ?').get(code, t.type).n;
        if (n > 0) errors[`type:${t.type}`] = `${n} document(s) of this type exist. It cannot be turned off.`;
      }
      for (const t of types.filter(x => x.enabled)) {
        const old = curTypes.find(x => x.type === t.code);
        const n = db.prepare('SELECT COUNT(*) n FROM documents WHERE project = ? AND type = ?').get(code, t.code).n;
        if (old && n > 0 && old.first_number !== t.firstNumber) errors[`first:${t.code}`] = 'Numbering has started. The first number cannot change now.';
        if (!db.prepare('SELECT 1 FROM types WHERE code = ?').get(t.code)) errors[`type:${t.code}`] = 'Unknown document type.';
      }
      if (Object.keys(errors).length) throw bad('Please fix the highlighted fields.', errors);
      const changes = [];
      if (name !== cur.name) changes.push(`name "${cur.name}" → "${name}"`);
      if (status !== cur.status) changes.push(`status ${cur.status} → ${status}`);
      const addedF = folders.filter(f => !curFolders.includes(f)), removedF = curFolders.filter(f => !folders.includes(f));
      if (addedF.length) changes.push(`folders added: ${addedF.join(', ')}`);
      if (removedF.length) changes.push(`folders removed: ${removedF.join(', ')}`);
      const turnedOn = types.filter(t => t.enabled && !curTypes.find(x => x.type === t.code)).map(t => t.code);
      const turnedOff = curTypes.filter(x => !types.find(y => y.code === x.type && y.enabled)).map(x => x.type);
      if (turnedOn.length) changes.push(`types on: ${turnedOn.join(', ')}`);
      if (turnedOff.length) changes.push(`types off: ${turnedOff.join(', ')}`);
      const remapped = types.filter(t => t.enabled && curTypes.find(x => x.type === t.code && x.folder !== t.folder)).map(t => `${t.code} → ${t.folder}`);
      if (remapped.length) changes.push(`filed to new folder (existing documents keep theirs): ${remapped.join('; ')}`);
      db.prepare('UPDATE projects SET name = ?, status = ? WHERE code = ?').run(name, status, code);
      db.prepare('DELETE FROM project_folders WHERE project = ?').run(code);
      for (const f of folders) db.prepare('INSERT INTO project_folders (project, path) VALUES (?,?)').run(code, f);
      db.prepare('DELETE FROM project_types WHERE project = ?').run(code);
      for (const t of types.filter(x => x.enabled)) {
        db.prepare('INSERT INTO project_types (project, type, folder, first_number) VALUES (?,?,?,?)').run(code, t.code, t.folder, t.firstNumber);
      }
      audit(actor, 'Changed project', null, `${code}: ${changes.length ? changes.join(' · ') : 'no changes'}`);
      return changes.length;
    });
  }
  
  function listTypes() {
    return db.prepare('SELECT * FROM types ORDER BY code').all();
  }
  function listUsers() {
    return db.prepare('SELECT name, role FROM users ORDER BY name').all();
  }
  function listAudit({ documentId, limit = 200 } = {}) {
    return db.prepare(`SELECT a.*, d.number FROM audit a LEFT JOIN documents d ON d.id = a.document_id
      WHERE (? IS NULL OR a.document_id = ?) ORDER BY a.id DESC LIMIT ?`).all(documentId ?? null, documentId ?? null, limit);
  }
  function fileForSha(sha) {
    if (!/^[a-f0-9]{64}$/.test(sha)) throw notFound('File');
    const p = path.join(filesDir, sha);
    if (!fs.existsSync(p)) throw notFound('File');
    return p;
  }

  /* ---------- writes ---------- */
  function createDocument(actor, b) {
    const role = actorRole(actor);
    return tx(db, () => {
      const t = typeInfo(b.type);
      const project = db.prepare('SELECT * FROM projects WHERE code = ?').get(b.project);
      if (!project) throw bad('Choose a project.', { project: 'Choose a project.' });
      const title = (b.title || '').trim();
      const owner = b.owner || actor;
      const fields = {};
      if (!title) fields.title = 'Give it a title.';
      if (!db.prepare('SELECT 1 FROM users WHERE name = ?').get(owner)) fields.owner = 'Choose an owner.';
      if (project.status !== 'active') throw bad('This project is archived. Nothing new can be added.');
      const pt = db.prepare('SELECT * FROM project_types WHERE project = ? AND type = ?').get(b.project, b.type);
      if (!pt) throw bad('This document type is not turned on for this project.', { type: 'Not used on this project.' });
      const number = R.nextNumber(b.project, b.type, allNumbers(), pt.first_number);
      if (t.cls === 'periodic') {
        const dd = Number(b.dueDay);
        if (!(Number.isInteger(dd) && dd >= 1 && dd <= 28)) fields.dueDay = 'Due day must be 1 to 28.';
        if (!/^\d{4}-\d{2}$/.test(b.start || '') || b.start > R.monthKey(now())) fields.start = 'First month cannot be in the future.';
        if (Object.keys(fields).length) throw bad('Please fix the highlighted fields.', fields);
        const id = db.prepare(`INSERT INTO documents (project,type,cls,number,title,folder,owner,due_day,start_period,sp_name,created_at,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.project, b.type, 'periodic', number, title, pt.folder, owner, dd, b.start, number + '.pdf', nowIso(), actor).lastInsertRowid;
        
        audit(actor, 'Created recurring series', Number(id), `${number} · ${title} · due day ${dd} · from ${b.start}`);
        return Number(id);
      }
      if (!b.file) fields.file = 'Choose a file.';
      const file = b.file ? { name: b.file.name, size: b.file.buffer.length, buffer: b.file.buffer } : null;
      const fileProblems = R.fileErrors(file ? { name: file.name, size: file.size } : null);
      Object.assign(fields, fileProblems, R.summaryErrors(b.summary));
      if (t.cls === 'controlled') {
        Object.assign(fields, R.revisionErrors({ uploader: actor, checker: b.checker, approver: b.approver, reason: b.reason, summary: b.summary, note: b.note, file: file ? { name: file.name, size: file.size } : null }));
        if (!owner) fields.owner = 'Choose an owner.';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(b.expiresOn || '') || b.expiresOn <= today()) {
        fields.expiresOn = 'Enter an expiry date after today.';
      }
      if (Object.keys(fields).length) throw bad('Please fix the highlighted fields.', fields);
      const stored = storeFile(file);
      const id = Number(db.prepare(`INSERT INTO documents (project,type,cls,number,title,folder,owner,sp_name,created_at,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(b.project, b.type, t.cls, number, title, pt.folder, owner, number + '.' + stored.name.split('.').pop(), nowIso(), actor).lastInsertRowid);
      
      if (t.cls === 'controlled') {
        db.prepare(`INSERT INTO revisions (document_id,n,status,reason,summary,note,file_name,file_sha256,file_size,by,checker,approver,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, 0, 'Submitted', b.reason, b.summary.trim(), b.note.trim(), stored.name, stored.sha256, stored.size, actor, b.checker, b.approver, nowIso());
        audit(actor, 'Created document', id, `${number} · ${title} · rev 0 waiting for ${b.checker}`);
      } else {
        db.prepare(`INSERT INTO certificate_versions (document_id,n,summary,file_name,file_sha256,file_size,expires_on,by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(id, 0, b.summary.trim(), stored.name, stored.sha256, stored.size, b.expiresOn, actor, nowIso());
        audit(actor, 'Created certificate', id, `${number} · ${title} · expires ${b.expiresOn}`);
      }
      return id;
    });
  }
  
  function submitRevision(actor, docId, b) {
    actorRole(actor);
    return tx(db, () => {
      const d = docRow(docId);
      if (d.cls !== 'controlled') throw bad('This document is not a controlled document.');
      if (d.deleted) throw bad('This document is removed.');
      const file = b.file ? { name: b.file.name, size: b.file.buffer.length, buffer: b.file.buffer } : null;
      const fields = Object.assign({}, R.revisionErrors({ uploader: actor, checker: b.checker, approver: b.approver, reason: b.reason, summary: b.summary, note: b.note, file: file ? { name: file.name, size: file.size } : null }));
      if (Object.keys(fields).length) throw bad('Please fix the highlighted fields.', fields);
      const n = db.prepare('SELECT COALESCE(MAX(n),-1)+1 n FROM revisions WHERE document_id = ?').get(docId).n;
      const stored = storeFile(file);
      db.prepare(`INSERT INTO revisions (document_id,n,status,reason,summary,note,file_name,file_sha256,file_size,by,checker,approver,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(docId, n, 'Submitted', b.reason, b.summary.trim(), b.note.trim(), stored.name, stored.sha256, stored.size, actor, b.checker, b.approver, nowIso());
      audit(actor, 'Added revision', docId, `${d.number} rev ${n} · waiting for ${b.checker}`);
      return n;
    });
  }
  function transition(actor, revId, check, nextStatus, extra, verb) {
    actorRole(actor);
    return tx(db, () => {
      const r = revRow(revId);
      const d = docRow(r.document_id);
      if (d.deleted) throw bad('This document is removed.');
      const problem = check(r, actor);
      if (problem) throw forbid(problem);
      const sets = [];
      const args = [];
      sets.push('status = ?'); args.push(nextStatus);
      for (const [col, val] of Object.entries(extra)) { sets.push(`${col} = ?`); args.push(val); }
      args.push(revId);
      db.prepare(`UPDATE revisions SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      audit(actor, verb, d.id, `${d.number} rev ${r.n} ${verb.toLowerCase()}${extra.return_note ? ': ' + extra.return_note : ''}`);
      return r.n;
    });
  }
  const checkRevision = (actor, revId) => transition(actor, revId, R.canCheck, 'Checked', { checked_by: actor }, 'Checked');
  const approveRevision = (actor, revId) => transition(actor, revId, R.canApprove, 'Approved', { approved_by: actor }, 'Approved');
  function returnRevision(actor, revId, text) {
    const t = (text || '').trim();
    if (t.length < 10) throw bad('Write at least 10 characters to say what must change.', { text: 'Write at least 10 characters.' });
    return transition(actor, revId, R.canReturn, 'Returned', { return_note: t }, 'Returned');
  }

  function uploadPeriod(actor, docId, key, b) {
    const role = actorRole(actor);
    return tx(db, () => {
      const d = docRow(docId);
      if (d.cls !== 'periodic') throw bad('This is not a recurring series.');
      if (d.deleted) throw bad('This series is removed.');
      const denied = R.canUploadPeriod(d, actor, role);
      if (denied) throw forbid(denied);
      if (!/^\d{4}-\d{2}$/.test(key)) throw bad('Period must look like 2026-10.');
      if (key < d.start_period || key > R.monthKey(now())) throw bad('That period is not open for upload.');
      const existing = db.prepare('SELECT * FROM periods WHERE document_id = ? AND period = ? ORDER BY version DESC LIMIT 1').get(docId, key);
      if (b.mode === 'na') {
        const f = R.naErrors(b.naReason);
        if (Object.keys(f).length) throw bad('Please fix the highlighted fields.', f);
        if (existing && !existing.na && existing.file_sha256) throw bad('This period already has a file. Replace it instead.');
        db.prepare('INSERT INTO periods (document_id,period,version,na,na_reason,by,uploaded_at) VALUES (?,?,?,?,?,?,?)')
          .run(docId, key, existing ? existing.version + 1 : 1, 1, b.naReason.trim(), actor, nowIso());
        audit(actor, 'Marked not needed', docId, `${d.number} ${key}: ${b.naReason.trim()}`);
        return key;
      }
      const file = b.file ? { name: b.file.name, size: b.file.buffer.length, buffer: b.file.buffer } : null;
      const f = R.periodErrors({ file: file ? { name: file.name, size: file.size } : null, summary: b.summary, replaceReason: b.replaceReason, existing: !!(existing && !existing.na && existing.file_sha256) });
      if (Object.keys(f).length) throw bad('Please fix the highlighted fields.', f);
      const stored = storeFile(file);
      const version = existing ? existing.version + 1 : 1;
      const late = nowIso().slice(0, 10) > R.dueDate(key, d.due_day);
      db.prepare(`INSERT INTO periods (document_id,period,version,summary,file_name,file_sha256,file_size,replace_reason,by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(docId, key, version, b.summary.trim(), stored.name, stored.sha256, stored.size, existing ? (b.replaceReason || '').trim() : null, actor, nowIso());
      audit(actor, existing ? 'Replaced period' : 'Uploaded period', docId, `${d.number} ${key}${late ? ' (late)' : ''}: ${b.summary.trim()}`);
      return key;
    });
  }

  function renewCertificate(actor, docId, b) {
    const role = actorRole(actor);
    return tx(db, () => {
      const d = docRow(docId);
      if (d.cls !== 'record') throw bad('This is not a certificate.');
      if (d.deleted) throw bad('This document is removed.');
      const denied = R.canUploadPeriod(d, actor, role);
      if (denied) throw forbid(denied.replace('series', 'certificate'));
      const file = b.file ? { name: b.file.name, size: b.file.buffer.length, buffer: b.file.buffer } : null;
      const f = R.renewalErrors({ file: file ? { name: file.name, size: file.size } : null, summary: b.summary, expiresOn: b.expiresOn, today: today() });
      if (Object.keys(f).length) throw bad('Please fix the highlighted fields.', f);
      const n = db.prepare('SELECT COALESCE(MAX(n),-1)+1 n FROM certificate_versions WHERE document_id = ?').get(docId).n;
      const stored = storeFile(file);
      db.prepare(`INSERT INTO certificate_versions (document_id,n,summary,file_name,file_sha256,file_size,expires_on,by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(docId, n, b.summary.trim(), stored.name, stored.sha256, stored.size, b.expiresOn, actor, nowIso());
      audit(actor, 'Renewed certificate', docId, `${d.number} version ${n} · expires ${b.expiresOn}`);
      return n;
    });
  }

  function removeDocument(actor, docId, b) {
    const role = actorRole(actor);
    const denied = R.canRemove(role);
    if (denied) throw forbid(denied);
    return tx(db, () => {
      const d = docRow(docId);
      const f = R.removeErrors(b);
      if (Object.keys(f).length) throw bad('Please fix the highlighted fields.', f);
      if (d.deleted) throw bad('Already removed.');
      const newName = `DELETED_${today().replace(/-/g, '')}_${d.number}.pdf`;
      db.prepare('UPDATE documents SET deleted = 1, sp_name = ? WHERE id = ?').run(newName, docId);
      audit(actor, 'Removed document', docId, `${d.number} (${b.reason}): ${b.text.trim()}. Renamed to ${newName}. Nothing erased.`);
      return newName;
    });
  }
  function restoreDocument(actor, docId) {
    const role = actorRole(actor);
    if (role !== 'admin') throw forbid('Only the records lead can restore a document.');
    return tx(db, () => {
      const d = docRow(docId);
      if (!d.deleted) throw bad('This document is not removed.');
      db.prepare('UPDATE documents SET deleted = 0, sp_name = ? WHERE id = ?').run(d.number + '.pdf', docId);
      audit(actor, 'Restored document', docId, `${d.number} restored. Name set back.`);
      return true;
    });
  }

  return {
    listDocuments, getDocument, listProjects, getProject, standardTemplate, createProject, updateProject, listTypes, listUsers, listAudit, fileForSha,
    createDocument, submitRevision, checkRevision, approveRevision, returnRevision,
    uploadPeriod, renewCertificate, removeDocument, restoreDocument, actorRole,
  };
}

module.exports = { createService, AppError };
