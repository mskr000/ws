'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require('../src/rules');
const { openDb } = require('../src/db');
const { createService } = require('../src/service');
const { seedDemo } = require('../src/seed');
const { BUILT_IN_TEMPLATES } = require('../src/template');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-extra-'));
  const db = openDb(':memory:');
  const filesDir = path.join(dir, 'files');
  seedDemo(db, filesDir);
  return { db, service: createService({ db, filesDir, now: () => new Date('2026-11-06T09:00:00Z') }), filesDir };
}
const pdf = () => ({ name: 'x.pdf', buffer: Buffer.from('content of a drawing') });

test('numbering pattern: needs exactly one SEQ, allowed characters only', () => {
  assert.equal(R.patternErrors('{PROJ}-{TYPE}-{SEQ:4}'), null);
  assert.match(R.patternErrors('{PROJ}-{TYPE}'), /one \{SEQ\}/);
  assert.match(R.patternErrors('{PROJ}-{SEQ}-{SEQ}'), /one \{SEQ\}/);
  assert.match(R.patternErrors('{PROJ}-{BAD}-{SEQ}'), /Unknown token/);
  assert.match(R.patternErrors('{PROJ} {SEQ}'), /Only letters/);
  assert.match(R.patternErrors('{PROJ}-{SEQ:9}'), /width/);
  assert.match(R.patternErrors(''), /Enter a numbering pattern/);
});

test('numbering pattern: formats and continues per project and type', () => {
  assert.equal(R.formatNumber('{PROJ}.{TYPE}.{YYYY}.{SEQ:3}', { project: 'U100', type: 'PID', seq: 7, year: 2026 }), 'U100.PID.2026.007');
  const n = R.nextNumber({ pattern: '{PROJ}/{TYPE}/{YYYY}/{SEQ:3}', project: 'U100', type: 'PID', existingNumbers: ['U100/PID/2026/004', 'TF7/PID/2026/090'], year: 2026 });
  assert.equal(n, 'U100/PID/2026/005');
  assert.equal(R.nextNumber({ project: 'U100', type: 'PID', existingNumbers: [], firstNumber: 457 }), 'U100-PID-0457');
});

test('a project can use its own numbering pattern', () => {
  const { service } = setup();
  service.createProject('Mia', { code: 'AB7', name: 'Pattern test', folders: ['EPC/02 Engineering/02.1 Process'],
    numberPattern: '{PROJ}.{TYPE}.{YYYY}.{SEQ:3}', types: [{ code: 'PID', enabled: true, folder: 'EPC/02 Engineering/02.1 Process', firstNumber: 1 }] });
  const id = service.createDocument('Sam', { project: 'AB7', type: 'PID', title: 'Feed', reason: 'Design change', summary: 'First issue of the feed P&ID', note: 'Check the vents', checker: 'Priya', approver: 'Tom', file: pdf() });
  assert.equal(service.getDocument(id).number, 'AB7.PID.2026.001');
});

test('numbering pattern cannot change once numbering has started', () => {
  const { service } = setup();
  const p = service.getProject('U100');
  const base = { name: p.name, status: 'active', folders: p.folders.map(f => f.path), types: p.types.map(t => ({ code: t.code, enabled: t.enabled, folder: t.folder, firstNumber: t.firstNumber })) };
  assert.throws(() => service.updateProject('Mia', 'U100', { ...base, numberPattern: '{PROJ}/{TYPE}/{SEQ:4}' }), e => Boolean(e.fields.numberPattern));
  service.updateProject('Mia', 'U100', { ...base, numberPattern: '{PROJ}-{TYPE}-{SEQ:4}' });
});

test('built-in templates are complete: every type files into a template folder', () => {
  assert.equal(BUILT_IN_TEMPLATES.length, 3);
  for (const t of BUILT_IN_TEMPLATES) {
    assert.equal(R.patternErrors(t.numberPattern), null, t.id);
    for (const ty of t.types) assert.ok(t.folders.includes(ty.folder), `${t.id}: ${ty.code} folder`);
  }
});

test('a template fills a new project; it can be saved from an existing project', () => {
  const { service } = setup();
  const tpl = service.getTemplate('operations-only');
  assert.equal(tpl.types.length, 6);
  service.createProject('Mia', { code: 'OPS7', name: 'Plant ops', folders: tpl.folders, numberPattern: tpl.numberPattern, types: tpl.types });
  const saved = service.saveTemplate('Mia', { name: 'U100 house style', description: 'From U100', code: 'U100' });
  assert.match(saved, /^custom-\d+$/);
  assert.equal(service.getTemplate(saved).name, 'U100 house style');
  assert.throws(() => service.saveTemplate('Mia', { name: 'U100 house style', code: 'U100' }), e => e.status === 400);
  assert.throws(() => service.saveTemplate('Sam', { name: 'Mine', code: 'U100' }), e => e.status === 403);
});

test('CSV upload: folders and types are read and checked', () => {
  const { service } = setup();
  const good = service.previewFolderCsv('folder,types\nEPC/02 Engineering/02.1 Process,PID;PFD\nOperations/03 Maintenance,MNT\n');
  assert.deepEqual(good.errors, []);
  assert.equal(good.folders.length, 2);
  assert.equal(good.types.length, 3);
  const bad = service.previewFolderCsv('folder,types\nEPC/02 Engineering/02.1 Process,NOPE\n,PID\n');
  assert.ok(bad.errors.some(e => /not in the document type list/.test(e.message)));
  assert.ok(bad.errors.some(e => /folder is empty/i.test(e.message)));
});

test('CSV upload without a types column files standard types into the listed folders', () => {
  const { service } = setup();
  const r = service.previewFolderCsv('EPC/02 Engineering/02.1 Process\nEPC/02 Engineering/02.2 Piping\nOperations/03 Maintenance\n');
  assert.equal(r.usedDefaults, true);
  assert.ok(r.types.some(t => t.code === 'PID' && t.folder === 'EPC/02 Engineering/02.1 Process'));
  assert.ok(r.types.some(t => t.code === 'MNT'));
});

test('a folder CSV can create a project directly', () => {
  const { service } = setup();
  const preview = service.previewFolderCsv('folder,types\nEPC/02 Engineering/02.1 Process,PID\nEPC/02 Engineering/02.2 Piping,ISO\n');
  service.createProject('Mia', { code: 'CSV1', name: 'From CSV', folders: preview.folders, types: preview.types });
  const p = service.getProject('CSV1');
  assert.equal(p.folders.length, 2);
  assert.deepEqual(p.types.filter(t => t.enabled).map(t => t.code).sort(), ['ISO', 'PID']);
});
