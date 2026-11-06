'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/db');
const { createService } = require('../src/service');
const { seedDemo } = require('../src/seed');
const { TEMPLATE } = require('../src/template');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-proj-'));
  const db = openDb(':memory:');
  const filesDir = path.join(dir, 'files');
  seedDemo(db, filesDir);
  const service = createService({ db, filesDir, now: () => new Date('2026-11-06T09:00:00Z') });
  return { db, service, filesDir };
}
const pdf = () => ({ name: 'x.pdf', buffer: Buffer.from('content of a drawing') });
const expectError = (fn, status) => assert.throws(fn, e => e.status === status);

/* A new project built from the standard template, with a few types turned off. */
function newProjectBody(over = {}) {
  return {
    code: 'SS9', name: 'New Substation SS-9',
    folders: TEMPLATE.folders,
    types: TEMPLATE.types.map(t => ({ code: t.code, enabled: ['PID', 'SLD', 'CERT'].includes(t.code), folder: t.folder, firstNumber: t.code === 'PID' ? 457 : 1 })),
    ...over,
  };
}

test('only the records lead can add a project', () => {
  const { service } = setup();
  expectError(() => service.createProject('Sam', newProjectBody()), 403);
  assert.equal(service.createProject('Mia', newProjectBody()), 'SS9');
});

test('project code: 2 to 5 capitals or digits, unique', () => {
  const { service } = setup();
  for (const code of ['A', 'TOOLONG', 'ab-1', '']) {
    assert.throws(() => service.createProject('Mia', newProjectBody({ code })), e => e.status === 400 && Boolean(e.fields.code));
  }
  assert.throws(() => service.createProject('Mia', newProjectBody({ code: 'U100' })), e => Boolean(e.fields.code && e.fields.code.includes('already exists')));
});

test('folder paths: 1 to 4 levels, no empty or parent segments, no duplicates', () => {
  const { service } = setup();
  assert.throws(() => service.createProject('Mia', newProjectBody({ folders: ['EPC/../secret'] })), e => e.status === 400);
  assert.throws(() => service.createProject('Mia', newProjectBody({ folders: ['A/B/C/D/E'] })), e => e.status === 400);
  assert.throws(() => service.createProject('Mia', newProjectBody({ folders: ['EPC', 'EPC'] })), e => e.status === 400);
  assert.throws(() => service.createProject('Mia', newProjectBody({ folders: ['EPC//x'] })), e => e.status === 400);
});

test('a type must file into a folder that exists in the project', () => {
  const { service } = setup();
  const body = newProjectBody();
  body.types[0].folder = 'Nowhere/Missing';
  assert.throws(() => service.createProject('Mia', body), e => e.status === 400 && Object.keys(e.fields).some(k => k.startsWith('type:')));
});

test('a new project gets its folders, types and first number; a document uses them', () => {
  const { service } = setup();
  service.createProject('Mia', newProjectBody());
  const p = service.getProject('SS9');
  assert.equal(p.folders.length, TEMPLATE.folders.length);
  assert.equal(p.types.filter(t => t.enabled).length, 3);
  const id = service.createDocument('Sam', { project: 'SS9', type: 'PID', title: 'Feed P&ID', reason: 'Design change', summary: 'First issue of the feed P&ID', note: 'Check the vents', checker: 'Priya', approver: 'Tom', file: pdf() });
  const d = service.getDocument(id);
  assert.equal(d.number, 'SS9-PID-0457');
  assert.equal(d.folder, 'EPC/02 Engineering/02.1 Process');
});

test('a type that is turned off cannot be used on the project', () => {
  const { service } = setup();
  service.createProject('Mia', newProjectBody());
  assert.throws(() => service.createDocument('Sam', { project: 'SS9', type: 'ISO', title: 'Iso', reason: 'Design change', summary: 'A piping isometric drawing', note: 'Check the spool', checker: 'Priya', approver: 'Tom', file: pdf() }), e => e.status === 400);
});

test('numbers continue from the first number and are never reused', () => {
  const { service } = setup();
  service.createProject('Mia', newProjectBody());
  const base = { project: 'SS9', type: 'PID', reason: 'Design change', summary: 'Drawing summary line text', note: 'Check the vents', checker: 'Priya', approver: 'Tom', file: pdf() };
  const a = service.createDocument('Sam', { ...base, title: 'One' });
  const b = service.createDocument('Sam', { ...base, title: 'Two' });
  assert.equal(service.getDocument(a).number, 'SS9-PID-0457');
  assert.equal(service.getDocument(b).number, 'SS9-PID-0458');
});

test('updating: a folder with documents cannot be removed', () => {
  const { service } = setup();
  const u100 = service.getProject('U100');
  const folders = u100.folders.map(f => f.path).filter(f => f !== 'EPC/02 Engineering/02.1 Process');
  const types = u100.types.map(t => ({ code: t.code, enabled: t.enabled, folder: t.folder, firstNumber: t.firstNumber }));
  const types2 = types.map(t => (t.code === 'PID' ? { ...t, folder: 'EPC/02 Engineering/02.2 Piping' } : t));
  assert.throws(() => service.updateProject('Mia', 'U100', { name: 'Unit 100 Refinery', status: 'active', folders, types: types2 }),
    e => e.status === 400 && Object.keys(e.fields).some(k => k.startsWith('folder:')));
});

test('updating: a type with documents cannot be turned off, and numbering cannot restart', () => {
  const { service } = setup();
  const p = service.getProject('U100');
  const folders = p.folders.map(f => f.path);
  const off = p.types.map(t => ({ code: t.code, enabled: t.code === 'PID' ? false : t.enabled, folder: t.folder, firstNumber: t.firstNumber }));
  assert.throws(() => service.updateProject('Mia', 'U100', { name: p.name, status: 'active', folders, types: off }), e => Boolean(e.fields['type:PID']));
  const restart = p.types.map(t => ({ code: t.code, enabled: t.enabled, folder: t.folder, firstNumber: t.code === 'PID' ? 1 : t.firstNumber }));
  assert.throws(() => service.updateProject('Mia', 'U100', { name: p.name, status: 'active', folders, types: restart.map(t => (t.code === 'PID' ? { ...t, firstNumber: 900 } : t)) }), e => Boolean(e.fields['first:PID']));
});

test('updating: changes are logged; archived projects take no new documents', () => {
  const { service } = setup();
  const p = service.getProject('TF7');
  const types = p.types.map(t => ({ code: t.code, enabled: t.enabled, folder: t.folder, firstNumber: t.firstNumber }));
  service.updateProject('Mia', 'TF7', { name: 'Tank Farm TF-7 (renamed)', status: 'archived', folders: p.folders.map(f => f.path), types });
  assert.equal(service.getProject('TF7').status, 'archived');
  const log = service.listAudit({}).find(r => r.action === 'Changed project');
  assert.match(log.detail, /renamed/);
  assert.throws(() => service.createDocument('Sam', { project: 'TF7', type: 'PID', title: 'x', reason: 'Design change', summary: 'A summary line of enough length', note: 'Check it please', checker: 'Priya', approver: 'Tom', file: pdf() }), e => e.status === 400);
});

test('only the records lead can change a project', () => {
  const { service } = setup();
  const p = service.getProject('U100');
  expectError(() => service.updateProject('Sam', 'U100', { name: 'x', status: 'active', folders: p.folders.map(f => f.path), types: p.types.map(t => ({ code: t.code, enabled: t.enabled, folder: t.folder, firstNumber: t.firstNumber })) }), 403);
});
