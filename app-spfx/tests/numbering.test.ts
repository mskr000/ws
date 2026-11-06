import test from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../src/domain/numbering.ts';

test('pattern validation: one SEQ, known tokens, allowed characters', () => {
  assert.equal(N.patternError('{PROJ}-{TYPE}-{SEQ:4}'), null);
  assert.match(N.patternError('{PROJ}-{TYPE}') as string, /one \{SEQ\}/);
  assert.match(N.patternError('{PROJ}-{BAD}-{SEQ}') as string, /Unknown token/);
  assert.match(N.patternError('{PROJ} {SEQ}') as string, /Only letters/);
  assert.match(N.patternError('{PROJ}-{SEQ:9}') as string, /width/);
});

test('formats and continues per project and type', () => {
  assert.equal(N.formatNumber('{PROJ}.{TYPE}.{YYYY}.{SEQ:3}', { project: 'U100', type: 'PID', seq: 7, year: 2026 }), 'U100.PID.2026.007');
  assert.equal(N.nextNumber({ pattern: '{PROJ}-{TYPE}-{SEQ:4}', project: 'U100', type: 'PID', existing: ['U100-PID-0007', 'U100-PID-0002', 'TF7-PID-0099'] }), 'U100-PID-0008');
  assert.equal(N.nextNumber({ pattern: '{PROJ}/{TYPE}/{YYYY}/{SEQ:3}', project: 'U100', type: 'PID', existing: ['U100/PID/2026/004'], year: 2026 }), 'U100/PID/2026/005');
  assert.equal(N.nextNumber({ pattern: '{PROJ}-{TYPE}-{SEQ:4}', project: 'U100', type: 'PID', existing: [], firstNumber: 457 }), 'U100-PID-0457');
});
