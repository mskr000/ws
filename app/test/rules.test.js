'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/rules');

test('due date is day N of the following month', () => {
  assert.equal(R.dueDate('2026-10', 5), '2026-11-05');
  assert.equal(R.dueDate('2026-12', 10), '2027-01-10');
});

test('period states: on time, late, missing, open, upcoming, not needed', () => {
  const base = { periodKey: '2026-08', dueDay: 5 };
  assert.equal(R.periodState({ ...base, uploadedAt: '2026-09-04T10:00:00Z', today: '2026-11-06' }), 'on_time');
  assert.equal(R.periodState({ ...base, uploadedAt: '2026-09-09T10:00:00Z', today: '2026-11-06' }), 'late');
  assert.equal(R.periodState({ ...base, uploadedAt: null, today: '2026-11-06' }), 'missing');
  assert.equal(R.periodState({ ...base, uploadedAt: null, today: '2026-09-03' }), 'open');
  assert.equal(R.periodState({ periodKey: '2026-12', dueDay: 5, uploadedAt: null, today: '2026-11-06' }), 'upcoming');
  assert.equal(R.periodState({ ...base, na: true, today: '2026-11-06' }), 'not_needed');
});

test('certificate states from expiry date', () => {
  assert.equal(R.recordState('2027-03-01', '2026-11-06').state, 'valid');
  assert.equal(R.recordState('2026-11-20', '2026-11-06').state, 'expiring');
  assert.equal(R.recordState('2026-10-30', '2026-11-06').state, 'expired');
});

test('controlled revision needs three different people', () => {
  const base = { uploader: 'Sam', reason: 'Design change', summary: 'A valid one line summary here', note: 'Please check the vent points', file: { name: 'a.pdf', size: 10 } };
  assert.deepEqual(R.revisionErrors({ ...base, checker: 'Priya', approver: 'Tom' }), {});
  assert.ok(R.revisionErrors({ ...base, checker: 'Sam', approver: 'Tom' }).checker);
  assert.ok(R.revisionErrors({ ...base, checker: 'Priya', approver: 'Priya' }).approver);
  assert.ok(R.revisionErrors({ ...base, checker: 'Priya', approver: 'Sam' }).approver);
});

test('file type, size and empty file are refused', () => {
  assert.ok(R.fileErrors({ name: 'x.exe', size: 5 }).file);
  assert.ok(R.fileErrors({ name: 'x.pdf', size: 51 * 1024 * 1024 }).file);
  assert.ok(R.fileErrors({ name: 'x.pdf', size: 0 }).file);
  assert.deepEqual(R.fileErrors({ name: 'x.pdf', size: 5 }), {});
});

test('review actions follow the workflow', () => {
  const rev = { status: 'Submitted', by: 'Sam', checker: 'Priya', approver: 'Tom' };
  assert.equal(R.canCheck(rev, 'Priya'), null);
  assert.match(R.canCheck(rev, 'Sam'), /cannot check/);
  assert.match(R.canCheck(rev, 'Tom'), /Only Priya/);
  assert.equal(R.canApprove({ ...rev, status: 'Checked' }, 'Tom'), null);
  assert.match(R.canApprove({ ...rev, status: 'Checked' }, 'Priya'), /differ/);
});

test('recurring uploads: owner or records lead only', () => {
  const d = { owner: 'Mia' };
  assert.equal(R.canUploadPeriod(d, 'Mia', 'member'), null);
  assert.equal(R.canUploadPeriod(d, 'Sam', 'admin'), null);
  assert.match(R.canUploadPeriod(d, 'Sam', 'member'), /Only Mia/);
});

test('removal is admin only and needs a reason', () => {
  assert.match(R.canRemove('member'), /records lead/);
  assert.equal(R.canRemove('admin'), null);
  assert.ok(R.removeErrors({ reason: '', text: 'short' }).reason);
});

test('next number continues the stream and never reuses', () => {
  assert.equal(R.nextNumber({ project: 'U100', type: 'PID', existingNumbers: [] }), 'U100-PID-0001');
  assert.equal(R.nextNumber({ project: 'U100', type: 'PID', existingNumbers: ['U100-PID-0007', 'U100-PID-0002', 'TF7-PID-0099'] }), 'U100-PID-0008');
});
