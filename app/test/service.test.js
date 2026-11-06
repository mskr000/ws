'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/db');
const { createService } = require('../src/service');
const { seedDemo } = require('../src/seed');

function setup(nowIso = '2026-11-06T09:00:00Z') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
  const db = openDb(':memory:');
  const filesDir = path.join(dir, 'files');
  seedDemo(db, filesDir);
  const service = createService({ db, filesDir, now: () => new Date(nowIso) });
  return { db, service, filesDir };
}
const pdf = (name = 'x.pdf') => ({ name, buffer: Buffer.from('hello drawing content') });
const expectError = (fn, status) => assert.throws(fn, e => e.status === status);

const controlledBody = (overrides = {}) => ({
  project: 'U100', type: 'PID', title: 'Test skid P&ID', reason: 'Design change',
  summary: 'First issue of the skid P&ID', note: 'Check the vent points', checker: 'Priya', approver: 'Tom', file: pdf(), ...overrides,
});

test('controlled document gets the next number and a waiting revision', () => {
  const { service, db } = setup();
  const id = service.createDocument('Sam', controlledBody());
  const doc = service.getDocument(id);
  assert.equal(doc.number, 'U100-PID-1002');
  assert.equal(doc.revisions[0].status, 'Submitted');
  assert.equal(doc.revisions[0].sha256.length, 64);
});

test('uploader cannot check own revision; checker can; approver then makes it current', () => {
  const { service } = setup();
  const id = service.createDocument('Sam', controlledBody());
  const rev = service.getDocument(id).revisions[0].id;
  expectError(() => service.checkRevision('Sam', rev), 403);
  expectError(() => service.checkRevision('Tom', rev), 403);
  service.checkRevision('Priya', rev);
  expectError(() => service.approveRevision('Priya', rev), 403);
  service.approveRevision('Tom', rev);
  const doc = service.getDocument(id);
  assert.equal(doc.current, 0);
  assert.equal(doc.revisions[0].status, 'Approved');
});

test('a rejected upload writes nothing', () => {
  const { service, db } = setup();
  const before = db.prepare('SELECT COUNT(*) n FROM documents').get().n;
  expectError(() => service.createDocument('Sam', controlledBody({ checker: 'Sam' })), 400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM documents').get().n, before);
});

test('audit log is append-only at the database level', () => {
  const { db, service } = setup();
  service.createDocument('Sam', controlledBody());
  assert.throws(() => db.exec("UPDATE audit SET detail = 'changed'"), /append-only/);
  assert.throws(() => db.exec('DELETE FROM audit'), /append-only/);
});

test('every write is in the audit log', () => {
  const { service } = setup();
  const id = service.createDocument('Sam', controlledBody());
  const rev = service.getDocument(id).revisions[0].id;
  service.checkRevision('Priya', rev);
  const actions = service.listAudit({ documentId: id }).map(r => r.action);
  assert.ok(actions.includes('Checked'));
  assert.ok(actions.includes('Created document'));
});

test('recurring: owner uploads on time, others are refused, late is recorded as late', () => {
  const { service } = setup('2026-11-06T09:00:00Z');
  const series = service.listDocuments({ project: 'U100', cls: 'periodic' })[0];
  expectError(() => service.uploadPeriod('Sam', series.id, '2026-10', { mode: 'upload', file: pdf(), summary: 'October pump checks done' }), 403);
  service.uploadPeriod('Mia', series.id, '2026-10', { mode: 'upload', file: pdf(), summary: 'October pump checks done' });
  const p = service.getDocument(series.id).periods.find(x => x.period === '2026-10');
  assert.equal(p.state, 'late');
});

test('recurring: not needed needs a reason and counts as complete', () => {
  const { service } = setup();
  const series = service.listDocuments({ project: 'U100', cls: 'periodic' })[0];
  expectError(() => service.uploadPeriod('Mia', series.id, '2026-11', { mode: 'na', naReason: 'short' }), 400);
  service.uploadPeriod('Mia', series.id, '2026-11', { mode: 'na', naReason: 'Plant shutdown all month' });
  assert.equal(service.getDocument(series.id).periods.find(x => x.period === '2026-11').state, 'not_needed');
});

test('certificates: renewal needs a future expiry date; history is kept', () => {
  const { service } = setup();
  const cert = service.listDocuments({ project: 'U100', cls: 'record' })[0];
  expectError(() => service.renewCertificate('Mia', cert.id, { file: pdf(), summary: 'Renewed after inspection', expiresOn: '2026-01-01' }), 400);
  const n = service.renewCertificate('Mia', cert.id, { file: pdf(), summary: 'Renewed after inspection', expiresOn: '2027-12-01' });
  assert.equal(n, 1);
  assert.equal(service.getDocument(cert.id).versions.length, 2);
});

test('removal is admin only, needs a reason, renames and does not erase', () => {
  const { service } = setup();
  const id = service.createDocument('Sam', controlledBody());
  expectError(() => service.removeDocument('Sam', id, { reason: 'Created in error', text: 'Wrong drawing was uploaded here' }), 403);
  const name = service.removeDocument('Mia', id, { reason: 'Created in error', text: 'Wrong drawing was uploaded here' });
  assert.match(name, /^DELETED_\d{8}_U100-PID-1002\.pdf$/);
  assert.equal(service.getDocument(id).deleted, true);
  expectError(() => service.restoreDocument('Sam', id), 403);
  service.restoreDocument('Mia', id);
  assert.equal(service.getDocument(id).deleted, false);
});

test('file lookup refuses anything that is not a stored hash', () => {
  const { service } = setup();
  expectError(() => service.fileForSha('../../etc/passwd'), 404);
});

test('new project without numbering takes the typed number, then continues it', () => {
  const { service } = setup();
  const a = service.createDocument('Sam', controlledBody({ project: 'NEW1', type: 'ISO', number: 'NEW1-ISO-0001' }));
  assert.equal(service.getDocument(a).number, 'NEW1-ISO-0001');
  const b = service.createDocument('Sam', controlledBody({ project: 'NEW1', type: 'ISO', title: 'Second isometric' }));
  assert.equal(service.getDocument(b).number, 'NEW1-ISO-0002');
});
