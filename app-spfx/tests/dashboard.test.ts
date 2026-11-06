import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, periodKeysUpTo } from '../src/domain/dashboard.ts';
import { csvCell, transmittalCsv, transmittalText } from '../src/domain/transmittal.ts';

const today = '2026-11-06';
const base = { me: 'Mia', today, projects: [{ code: 'U100', name: 'Unit 100' }] };

test('periods run from the start month up to this month', () => {
  assert.deepEqual(periodKeysUpTo('2026-09', '2026-11-06'), ['2026-09', '2026-10', '2026-11']);
});

test('missing monthly periods are counted and listed for the owner', () => {
  const d = buildDashboard({ ...base, docs: [{ id: 1, number: 'U100-MNT-0001', title: 'Check', project: 'U100', kind: 'periodic', owner: 'Mia', removed: false, dueDay: 5, startPeriod: '2026-09' }],
    revisions: [], periods: [], certificates: [] });
  assert.equal(d.missingPeriods, 2); // Sep (due 5 Oct) and Oct (due 5 Nov)
  assert.equal(d.waitingForMe.filter(w => w.kind === 'missing').length, 2);
});

test('an upload on time counts as on time; a late one counts as late', () => {
  const d = buildDashboard({ ...base, docs: [{ id: 1, number: 'U100-MNT-0001', title: 'Check', project: 'U100', kind: 'periodic', owner: 'Mia', removed: false, dueDay: 5, startPeriod: '2026-08' }],
    revisions: [], periods: [
      { documentId: 1, periodKey: '2026-08', notNeeded: false, uploadedAt: '2026-09-04T10:00:00Z' },
      { documentId: 1, periodKey: '2026-09', notNeeded: false, uploadedAt: '2026-10-09T10:00:00Z' },
    ], certificates: [] });
  assert.equal(d.latePeriods, 1);
  assert.equal(d.progress[0].periodsOnTime, 1);
});

test('reviews waiting for me: checks and approvals only', () => {
  const docs = [{ id: 1, number: 'U100-PID-1001', title: 'P&ID', project: 'U100', kind: 'controlled' as const, owner: 'Sam', removed: false, dueDay: null, startPeriod: null }];
  const d = buildDashboard({ ...base, me: 'Priya', docs, revisions: [
    { documentId: 1, n: 2, status: 'Submitted', checker: 'Priya', approver: 'Tom', by: 'Sam' },
    { documentId: 1, n: 1, status: 'Approved', checker: 'Priya', approver: 'Tom', by: 'Sam' }], periods: [], certificates: [] });
  assert.equal(d.waitingForMe.length, 1);
  assert.equal(d.waitingForMe[0].kind, 'check');
});

test('certificates: expiring and expired counted; only owners get the alert', () => {
  const docs = [
    { id: 1, number: 'U100-CERT-0001', title: 'PV', project: 'U100', kind: 'record' as const, owner: 'Mia', removed: false, dueDay: null, startPeriod: null },
    { id: 2, number: 'U100-CERT-0002', title: 'FE', project: 'U100', kind: 'record' as const, owner: 'Sam', removed: false, dueDay: null, startPeriod: null },
  ];
  const d = buildDashboard({ ...base, docs, revisions: [], periods: [], certificates: [
    { documentId: 1, n: 0, expiresOn: '2026-11-28' }, { documentId: 2, n: 0, expiresOn: '2026-10-30' }] });
  assert.equal(d.expiring, 1);
  assert.equal(d.expired, 1);
  assert.equal(d.waitingForMe.length, 1);
  assert.equal(d.waitingForMe[0].kind, 'expiring');
});

test('CSV cells starting with a formula character are neutralised', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a, b'), '"a, b"');
});

test('transmittal CSV and text carry the header and every line', () => {
  const t = { to: 'Client A', date: '2026-11-06', purpose: 'For review', notes: '', lines: [{ number: 'U100-PID-1001', title: 'Pump layout', standing: 'Current: Rev 1' }] };
  const csv = transmittalCsv(t);
  assert.match(csv, /To,Client A/);
  assert.match(csv, /U100-PID-1001,Pump layout,Current: Rev 1/);
  const txt = transmittalText(t);
  assert.match(txt, /^TRANSMITTAL/);
  assert.ok(txt.includes('U100-PID-1001\tPump layout'));
});
