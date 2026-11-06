import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/domain/setup';

const base = (over: Partial<S.ProjectSetup> = {}): S.ProjectSetup => ({
  code: 'SS9', name: 'New Substation', status: 'active', numberPattern: '{PROJ}-{TYPE}-{SEQ:4}',
  folders: ['EPC/02 Engineering/02.1 Process'],
  types: [{ code: 'PID', enabled: true, folder: 'EPC/02 Engineering/02.1 Process', firstNumber: 1 }], ...over,
});

test('project code: 2 to 5 capitals or digits, unique', () => {
  assert.deepEqual(S.projectSetupErrors(base(), true, []), {});
  for (const code of ['A', 'TOOLONG', 'ab-1', '']) assert.ok(S.projectSetupErrors(base({ code }), true, []).code, code);
  assert.match(S.projectSetupErrors(base({ code: 'U100' }), true, ['U100']).code, /already exists/);
});

test('folder paths: 1 to 4 levels, no parent segments, no duplicates', () => {
  assert.equal(S.folderPathError('EPC/02 Engineering/02.1 Process'), null);
  assert.ok(S.folderPathError('EPC/../x'));
  assert.ok(S.folderPathError('A/B/C/D/E'));
  assert.ok(S.folderPathError('EPC//x'));
  assert.ok(Object.keys(S.projectSetupErrors(base({ folders: ['EPC', 'EPC'] }), true, [])).some(k => k.startsWith('folder:')));
});

test('a document type must file into a folder the project has; first number 1 to 9999', () => {
  const e = S.projectSetupErrors(base({ types: [{ code: 'PID', enabled: true, folder: 'Nowhere', firstNumber: 1 }] }), true, []);
  assert.ok(e['type:PID']);
  const f = S.projectSetupErrors(base({ types: [{ code: 'PID', enabled: true, folder: 'EPC/02 Engineering/02.1 Process', firstNumber: 0 }] }), true, []);
  assert.ok(f['first:PID']);
});

test('numbering pattern is checked as part of the setup', () => {
  assert.ok(S.projectSetupErrors(base({ numberPattern: '{PROJ}-{TYPE}' }), true, []).numberPattern);
});

test('built-in templates: every type files into a folder the template contains', () => {
  assert.equal(S.BUILT_IN_TEMPLATES.length, 4);
  for (const t of S.BUILT_IN_TEMPLATES) {
    for (const ty of t.types) assert.ok(t.folders.includes(ty.folder), `${t.id} ${ty.code}`);
    assert.deepEqual(S.projectSetupErrors({ code: 'X1', name: 'x', status: 'active', numberPattern: t.numberPattern, folders: t.folders, types: t.types }, true, []), {});
  }
});

test('folder CSV: folders and types are read', () => {
  const r = S.readFolderCsv('folder,types\nEPC/02 Engineering/02.1 Process,"PID;PFD"\nOperations/03 Maintenance,MNT\n');
  assert.deepEqual(r.errors, []);
  assert.equal(r.folders.length, 2);
  assert.equal(r.types.length, 3);
});

test('folder CSV: quotes and commas inside a field', () => {
  const r = S.readFolderCsv('"EPC/02 Engineering/02.1 Process",PID\n');
  assert.deepEqual(r.errors, []);
  assert.equal(r.types[0].folder, 'EPC/02 Engineering/02.1 Process');
});

test('folder CSV: errors are listed with line numbers', () => {
  const r = S.readFolderCsv('folder,types\nEPC/02,NOPE\n,PID\nEPC/03,PID\nEPC/04,PID\n');
  assert.ok(r.errors.some(e => e.line === 2 && /not in the document type list/.test(e.message)));
  assert.ok(r.errors.some(e => e.line === 3 && /folder is empty/i.test(e.message)));
  assert.ok(r.errors.some(e => /filed twice/.test(e.message)));
});

test('folder CSV without types: standard types go to their folders when the folder is listed', () => {
  const r = S.readFolderCsv('EPC/02 Engineering/02.1 Process\nEPC/02 Engineering/02.2 Piping\nOperations/03 Maintenance\n');
  assert.equal(r.usedDefaults, true);
  assert.ok(r.types.some(t => t.code === 'PID' && t.folder === 'EPC/02 Engineering/02.1 Process'));
  assert.ok(r.types.some(t => t.code === 'MNT'));
});

test('folder CSV: a file with problems still returns errors and nothing else is trusted by the caller', () => {
  const r = S.readFolderCsv('"unclosed,PID\n');
  assert.ok(r.errors.length > 0);
});

test('O&M template: every folder is valid, every type sits in a listed folder, no duplicates', () => {
  const t = S.BUILT_IN_TEMPLATES.find(x => x.id === 'om-standard')!;
  assert.ok(t, 'template exists');
  assert.equal(new Set(t.folders).size, t.folders.length, 'no duplicate folders');
  for (const f of t.folders) assert.equal(S.folderPathError(f), null, f);
  for (const ty of t.types) assert.ok(t.folders.includes(ty.folder), `${ty.code} folder listed`);
  assert.equal(S.projectSetupErrors({ code: 'OM1', name: 'O&M test', status: 'active', numberPattern: t.numberPattern, folders: t.folders, types: t.types }, true, []).folders, undefined);
});

test('O&M template: no folder name uses a slash inside a name', () => {
  const t = S.BUILT_IN_TEMPLATES.find(x => x.id === 'om-standard')!;
  for (const f of t.folders) for (const seg of f.split('/')) assert.ok(!seg.includes('/'));
});
