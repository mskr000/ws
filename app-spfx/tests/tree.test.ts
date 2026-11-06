import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/domain/tree.ts';

test('tree builds parents from child paths, sorted, with depth', () => {
  const tree = T.folderTree(['Operations/Monthly reports', 'Engineering/Drawings/As-built', 'Engineering/NCN']);
  assert.deepEqual(tree.map(n => n.name), ['Engineering', 'Operations']);
  const eng = tree[0];
  assert.deepEqual(eng.children.map(c => c.name), ['Drawings', 'NCN']);
  assert.equal(eng.children[0].children[0].path, 'Engineering/Drawings/As-built');
  assert.equal(eng.children[0].children[0].depth, 2);
});

test('subtree lists a folder and only what is under it', () => {
  const all = ['A', 'A/B', 'A/B/C', 'A-old', 'AB'];
  assert.deepEqual(T.subtreePaths(all, 'A/B'), ['A/B', 'A/B/C']);
  assert.deepEqual(T.subtreePaths(all, 'A'), ['A', 'A/B', 'A/B/C']);
});

test('levels are counted from the path', () => {
  assert.equal(T.levelOf('A/B/C'), 3);
});

test('rename moves the folder and everything under it', () => {
  const rs = [{ from: 'A/B', to: 'A/Beta' }];
  assert.equal(T.applyRenames('A/B', rs), 'A/Beta');
  assert.equal(T.applyRenames('A/B/C/D', rs), 'A/Beta/C/D');
  assert.equal(T.applyRenames('A/Bx', rs), 'A/Bx', 'a sibling with the same start is not moved');
  assert.equal(T.applyRenames('A/C', rs), 'A/C');
});

test('renames apply in order, so a folder can be renamed twice before saving', () => {
  const rs = [{ from: 'A/B', to: 'A/C' }, { from: 'A/C', to: 'A/D' }];
  assert.equal(T.applyRenames('A/B/x', rs), 'A/D/x');
});

test('renamed path keeps the parent', () => {
  assert.equal(T.renamedPath('A/B', 'Z'), 'A/Z');
  assert.equal(T.renamedPath('Top', 'Z'), 'Z');
});

test('restoring a removed folder brings back what is under it and its removed parents', () => {
  const removed = ['A', 'A/B', 'A/B/C', 'D'];
  assert.deepEqual(T.restorePlan(removed, 'A/B').sort(), ['A', 'A/B', 'A/B/C'].sort());
  assert.deepEqual(T.restorePlan(removed, 'D'), ['D']);
});
