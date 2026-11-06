import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/domain/selection.ts';

const f = (o: Partial<S.CandidateFile>): S.CandidateFile => ({ key: 'k', docId: 1, number: 'U100-PID-1001', title: 'Pump layout', folder: 'Eng', kind: 'controlled',
  version: 'Rev 1', fileName: 'x.pdf', fileUrl: '#', checksum: '', status: 'current', standing: '', ...o });

test('only the current version is chosen by default; others need a confirm', () => {
  const files = [f({ key: 'a', status: 'superseded' }), f({ key: 'b', status: 'current' }), f({ key: 'c', status: 'in_review' })];
  assert.deepEqual(S.defaultChoice(files).map(x => x.key), ['b']);
  assert.equal(S.needsConfirm(files[0]), true);
  assert.equal(S.needsConfirm(files[1]), false);
});

test('pasted document numbers split on spaces, commas, semicolons and lines, without repeats', () => {
  assert.deepEqual(S.parseNumbers('U100-PID-1001, U100-PID-1002;\nU100-PID-1001  U100-MNT-0001'),
    ['U100-PID-1001', 'U100-PID-1002', 'U100-MNT-0001']);
});

test('filter by text or status, and paging with a clamped page number', () => {
  const files = [f({ key: 'a', number: 'U100-PID-1001', status: 'current' }), f({ key: 'b', number: 'U100-MNT-0001', title: 'Vibration', status: 'superseded' })];
  assert.equal(S.filesFilter(files, { text: 'vib' }).length, 1);
  assert.equal(S.filesFilter(files, { status: 'superseded' })[0].key, 'b');
  const items = Array.from({ length: 120 }, (_, i) => i);
  const p = S.pageOf(items, 99, 50);
  assert.equal(p.pages, 3);
  assert.equal(p.page, 3);
  assert.equal(p.items.length, 20);
});

test('a transmittal has a limit on files', () => {
  assert.equal(S.overLimit(S.MAX_LINES), null);
  assert.ok(S.overLimit(S.MAX_LINES + 1));
});

test('controlled: the latest approved revision is current; newer unapproved ones are shown as in review', () => {
  const doc = { id: 1, number: 'U100-PID-1001', title: 'Pump', folder: 'Eng', kind: 'controlled', removed: false };
  const revs = [
    { id: 10, n: 0, status: 'Approved', fileName: 'r0.pdf', fileUrl: '#a', checksum: '' },
    { id: 11, n: 1, status: 'Approved', fileName: 'r1.pdf', fileUrl: '#b', checksum: '' },
    { id: 12, n: 2, status: 'Submitted', fileName: 'r2.pdf', fileUrl: '#c', checksum: '' },
  ];
  const c = S.candidatesOf(doc, revs, [], []);
  const by = Object.fromEntries(c.map(x => [x.version, x.status]));
  assert.deepEqual(by, { 'Rev 0': 'superseded', 'Rev 1': 'current', 'Rev 2': 'in_review' });
  assert.deepEqual(S.defaultChoice(c).map(x => x.fileName), ['r1.pdf']);
});

test('monthly uploads: the latest upload in each month is current; older ones in that month are superseded', () => {
  const doc = { id: 2, number: 'U100-MNT-0001', title: 'Vibration', folder: 'Ops', kind: 'periodic', removed: false };
  const periods = [
    { id: 20, periodKey: '2026-06', version: 1, notNeeded: false, uploadedAt: 'x', fileName: 'j1.pdf', fileUrl: '#', checksum: '' },
    { id: 21, periodKey: '2026-06', version: 2, notNeeded: false, uploadedAt: 'y', fileName: 'j2.pdf', fileUrl: '#', checksum: '' },
    { id: 22, periodKey: '2026-07', version: 1, notNeeded: false, uploadedAt: 'z', fileName: 'l1.pdf', fileUrl: '#', checksum: '' },
  ];
  const c = S.candidatesOf(doc, [], periods, []);
  assert.equal(c.find(x => x.fileName === 'j1.pdf')!.status, 'superseded');
  assert.equal(c.find(x => x.fileName === 'j2.pdf')!.status, 'current');
  assert.equal(c.find(x => x.fileName === 'l1.pdf')!.status, 'current');
});

test('a removed document offers nothing as current', () => {
  const doc = { id: 3, number: 'X', title: 't', folder: 'f', kind: 'controlled', removed: true };
  const c = S.candidatesOf(doc, [{ id: 1, n: 0, status: 'Approved', fileName: 'a', fileUrl: '#', checksum: '' }], [], []);
  assert.equal(c[0].status, 'removed');
  assert.equal(S.defaultChoice(c).length, 0);
});
