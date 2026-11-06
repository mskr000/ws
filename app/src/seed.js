'use strict';
/* Reference data and demo content. Run with: node src/cli.js seed  (only on an empty database). */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const USERS = [['Sam', 'member'], ['Priya', 'member'], ['Tom', 'member'], ['Mia', 'admin']];
const PROJECTS = [['U100', 'Unit 100 Refinery'], ['TF7', 'Tank Farm TF-7']];
const { TYPE_ROWS: TYPES, FOLDERS } = require('./template');

function setupFromTemplate(db, code) {
  for (const f of FOLDERS) db.prepare('INSERT OR IGNORE INTO project_folders (project, path) VALUES (?, ?)').run(code, f);
  for (const [t, , , folder] of TYPES) db.prepare('INSERT OR IGNORE INTO project_types (project, type, folder, first_number) VALUES (?, ?, ?, 1)').run(code, t, folder);
}

function loadReference(db) {
  for (const [name, role] of USERS) db.prepare('INSERT OR IGNORE INTO users (name, role) VALUES (?, ?)').run(name, role);
  for (const [code, name] of PROJECTS) db.prepare('INSERT OR IGNORE INTO projects (code, name) VALUES (?, ?)').run(code, name);
  for (const row of TYPES) db.prepare('INSERT OR IGNORE INTO types (code, label, cls, folder) VALUES (?, ?, ?, ?)').run(...row);
  /* Projects created before project setup existed get the standard template once. */
  for (const [code] of PROJECTS) {
    const has = db.prepare('SELECT COUNT(*) n FROM project_types WHERE project = ?').get(code).n;
    if (!has) setupFromTemplate(db, code);
  }
}

function placeholderFile(filesDir, name) {
  const buf = Buffer.from(`Demo placeholder for ${name}. Replace with the real file.\n`);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  fs.mkdirSync(filesDir, { recursive: true });
  fs.writeFileSync(path.join(filesDir, sha), buf);
  return { sha, size: buf.length };
}

/* Demo content. Written directly so history dates are realistic. Only for an empty database. */
function seedDemo(db, filesDir) {
  const count = db.prepare('SELECT COUNT(*) n FROM documents').get().n;
  if (count > 0) throw new Error('Database is not empty. Seed only a new database.');
  loadReference(db);
  const ins = (sql, ...a) => db.prepare(sql).run(...a);
  const f = name => placeholderFile(filesDir, name);

  // Controlled: P&ID with rev 0 and 1 approved, rev 2 waiting for check.
  const d1 = Number(ins(`INSERT INTO documents (project,type,cls,number,title,folder,owner,sp_name,created_at,created_by) VALUES ('U100','PID','controlled','U100-PID-1001','Pump layout, Unit 100','EPC/02 Engineering/02.1 Process','Sam','U100-PID-1001.pdf','2026-02-03T09:00:00Z','Sam')`).lastInsertRowid);
  const rv = (doc, n, status, date, by, reason, summary, file, extra = {}) => {
    const x = f(file);
    ins(`INSERT INTO revisions (document_id,n,status,reason,summary,note,file_name,file_sha256,file_size,by,checker,approver,checked_by,approved_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, doc, n, status, reason, summary, extra.note || 'Demo note', file, x.sha, x.size, by,
      extra.checker || null, extra.approver || null, extra.checkedBy || null, extra.approvedBy || null, date + 'T09:00:00Z');
  };
  rv(d1, 0, 'Approved', '2026-02-03', 'Sam', 'Design change', 'First issue for internal review.', 'U100-PID-1001_r0.pdf', { checker: 'Priya', approver: 'Tom', checkedBy: 'Priya', approvedBy: 'Tom' });
  rv(d1, 1, 'Approved', '2026-04-10', 'Sam', 'Client comment', 'Moved pump 300 mm north after the site survey.', 'U100-PID-1001_r1.pdf', { checker: 'Priya', approver: 'Tom', checkedBy: 'Priya', approvedBy: 'Tom' });
  rv(d1, 2, 'Submitted', new Date().toISOString().slice(0, 10), 'Sam', 'Design change', 'Added a bypass valve on the cooling line.', 'U100-PID-1001_r2.pdf', { checker: 'Priya', approver: 'Tom' });

  // Controlled: startup procedure, one approved revision.
  const d2 = Number(ins(`INSERT INTO documents (project,type,cls,number,title,folder,owner,sp_name,created_at,created_by) VALUES ('U100','SOP','controlled','U100-SOP-0014','Unit 100 startup procedure','Operations/02 SOPs','Sam','U100-SOP-0014.pdf','2026-04-22T09:00:00Z','Sam')`).lastInsertRowid);
  rv(d2, 0, 'Approved', '2026-04-22', 'Sam', 'Design change', 'First issue.', 'U100-SOP-0014_r0.pdf', { checker: 'Priya', approver: 'Tom', checkedBy: 'Priya', approvedBy: 'Tom' });

  // Recurring: monthly pump vibration check, owned by Mia. Eight months on time, one late, two missing.
  const d3 = Number(ins(`INSERT INTO documents (project,type,cls,number,title,folder,owner,due_day,start_period,sp_name,created_at,created_by) VALUES ('U100','MNT','periodic','U100-MNT-0001','Monthly pump vibration check','Operations/03 Maintenance','Mia',5,'2026-01','U100-MNT-0001.pdf','2026-01-01T09:00:00Z','Mia')`).lastInsertRowid);
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  months.forEach((m, i) => {
    const late = m === '2026-08';
    const up = late ? '2026-09-09' : `${m.slice(0, 4)}-${String(Number(m.slice(5)) + 1).padStart(2, '0')}-04`;
    const x = f(`U100-MNT-0001_${m}.pdf`);
    ins(`INSERT INTO periods (document_id,period,version,summary,file_name,file_sha256,file_size,by,uploaded_at) VALUES (?,?,1,?,?,?,?,?,?)`,
      d3, m, late ? 'Uploaded late. Pump P-103 checked.' : 'All pumps within limits.', `U100-MNT-0001_${m}.pdf`, x.sha, x.size, 'Mia', `${up}T10:00:00Z`);
  });

  // Recurring: monthly operations report, owned by Priya. Ten months, one late.
  const d4 = Number(ins(`INSERT INTO documents (project,type,cls,number,title,folder,owner,due_day,start_period,sp_name,created_at,created_by) VALUES ('U100','RPT','periodic','U100-RPT-0001','Monthly operations report','Operations/05 Reports','Priya',5,'2026-01','U100-RPT-0001.pdf','2026-01-01T09:00:00Z','Priya')`).lastInsertRowid);
  for (let m = 1; m <= 10; m++) {
    const key = `2026-${String(m).padStart(2, '0')}`;
    const late = key === '2026-04';
    const up = late ? '2026-05-12' : `2026-${String(m + 1).padStart(2, '0')}-03`;
    const x = f(`U100-RPT-0001_${key}.pdf`);
    ins(`INSERT INTO periods (document_id,period,version,summary,file_name,file_sha256,file_size,by,uploaded_at) VALUES (?,?,1,?,?,?,?,?,?)`,
      d4, key, `${key} output and downtime summary.`, `U100-RPT-0001_${key}.pdf`, x.sha, x.size, 'Priya', `${up}T10:00:00Z`);
  }

  // Certificates: one expiring soon, one expired, one valid.
  const cert = (num, title, owner, expires, summary) => {
    const id = Number(ins(`INSERT INTO documents (project,type,cls,number,title,folder,owner,sp_name,created_at,created_by) VALUES ('U100','CERT',?,?,?,'Operations/06 Certificates',?,?,'2025-11-01T09:00:00Z',?)`,
      'record', num, title, owner, num + '.pdf', owner).lastInsertRowid);
    const x = f(num + '_v0.pdf');
    ins(`INSERT INTO certificate_versions (document_id,n,summary,file_name,file_sha256,file_size,expires_on,by,uploaded_at) VALUES (?,0,?,?,?,?,?,?,?)`,
      id, summary, num + '_v0.pdf', x.sha, x.size, expires, owner, '2025-11-01T09:00:00Z');
  };
  cert('U100-CERT-0001', 'Pressure vessel V-101 certificate', 'Mia', addDaysIso(20), 'Certificate issued by inspector.');
  cert('U100-CERT-0002', 'Fire extinguisher inspection', 'Sam', '2026-10-30', 'Annual inspection record.');
  cert('U100-CERT-0003', 'Crane load test certificate', 'Mia', '2027-06-30', 'Load test passed.');

  // Project stream already started for U100 and TF7; NEW1 has no numbering yet.

  ins(`INSERT INTO audit (at,who,action,document_id,detail) VALUES ('2026-02-03T09:00:00Z','Sam','Created document',?, 'U100-PID-1001 · rev 0')`, d1);
  ins(`INSERT INTO audit (at,who,action,document_id,detail) VALUES ('2026-09-09T16:10:00Z','Mia','Uploaded period',?, 'U100-MNT-0001 2026-08 (late)')`, d3);
}

function addDaysIso(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

module.exports = { loadReference, seedDemo, setupFromTemplate, USERS, PROJECTS };
