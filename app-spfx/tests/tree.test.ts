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
