import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/domain/permissions.ts';

const g = (user: string, cap: P.Cap, project = '*', folder = ''): P.Grant => ({ id: 1, user, cap, project, folder });

test('a grant for all projects covers every project and folder', () => {
  const gs = [g('Mia', 'projects')];
  assert.equal(P.allowed(gs, 'Mia', 'projects', 'U100', 'Engineering/Drawings'), true);
  assert.equal(P.allowed(gs, 'Sam', 'projects', 'U100'), false, 'other people get nothing');
});

test('a folder grant covers the folder and everything under it, not its neighbours', () => {
  const gs = [g('Tom', 'remove', 'U100', 'Operations/Reports')];
  assert.equal(P.allowed(gs, 'Tom', 'remove', 'U100', 'Operations/Reports'), true);
  assert.equal(P.allowed(gs, 'Tom', 'remove', 'U100', 'Operations/Reports/2026'), true);
  assert.equal(P.allowed(gs, 'Tom', 'remove', 'U100', 'Operations/Reports-old'), false);
  assert.equal(P.allowed(gs, 'Tom', 'remove', 'U100', 'Operations'), false);
  assert.equal(P.allowed(gs, 'Tom', 'remove', 'TF7', 'Operations/Reports'), false, 'other project');
});

test('a project grant with no folder covers all its folders', () => {
  const gs = [g('Priya', 'edit_any', 'U100')];
  assert.equal(P.allowed(gs, 'Priya', 'edit_any', 'U100', 'anything/here'), true);
  assert.equal(P.allowed(gs, 'Priya', 'edit_any', 'TF7', 'anything'), false);
});

test('capabilities are separate: having one does not give another', () => {
  const gs = [g('Sam', 'edit_any')];
  assert.equal(P.allowed(gs, 'Sam', 'remove', 'U100', ''), false);
});

test('presets give the expected sets', () => {
  assert.deepEqual(P.PRESETS['Member'], []);
  assert.ok(P.PRESETS['Records Lead'].includes('remove'));
  assert.ok(!P.PRESETS['Records Lead'].includes('permissions'));
  assert.ok(P.PRESETS['Admin'].includes('permissions'));
});

test('applying a preset to one folder makes folder-scoped grants', () => {
  const add = P.presetGrants('Records Lead', 'Mia', 'U100', 'Operations');
  assert.equal(add.length, 3);
  assert.ok(add.every(x => x.project === 'U100' && x.folder === 'Operations'));
});

test('a duplicate grant is refused', () => {
  const existing = [g('Mia', 'remove', 'U100', '')];
  assert.match(P.grantErrors({ user: 'Mia', cap: 'remove', project: 'U100', folder: '' }, existing) as string, /already/);
  assert.equal(P.grantErrors({ user: 'Mia', cap: 'remove', project: 'U100', folder: 'X' }, existing), null);
});

test('bootstrap gives the Records Lead group admin only when no grants exist', () => {
  const boot = P.bootstrapGrants(['Mia'], false);
  assert.ok(boot.some(x => x.user === 'Mia' && x.cap === 'permissions'));
  assert.deepEqual(P.bootstrapGrants(['Mia'], true), []);
});
