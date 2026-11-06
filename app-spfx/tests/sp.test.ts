import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/domain/sp.ts';

test('file names: SharePoint-unsafe characters are replaced', () => {
  assert.equal(S.safeFileName('pump #1 & layout?.pdf'), 'pump _1 _ layout_.pdf');
  assert.equal(S.safeFileName('a/b\\c:d.pdf'), 'a_b_c_d.pdf');
  assert.equal(S.safeFileName('  .hidden.pdf'), 'hidden.pdf');
  assert.equal(S.safeFileName(''), 'file');
});

test('file names: long names are shortened, extension kept', () => {
  const long = 'x'.repeat(300) + '.pdf';
  const out = S.safeFileName(long);
  assert.ok(out.length <= 130);
  assert.ok(out.endsWith('.pdf'));
});

test('OData strings: quotes are doubled', () => {
  assert.equal(S.odataString("O'Brien"), "'O''Brien'");
  assert.equal(S.odataString('U100'), "'U100'");
});

test('versions count up from the highest used', () => {
  assert.equal(S.nextVersion([]), 1);
  assert.equal(S.nextVersion([1, 2, 5]), 6);
});
