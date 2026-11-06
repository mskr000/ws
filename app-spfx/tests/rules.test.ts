import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/domain/rules.ts';

test('due date is day N of the following month', () => {
  assert.equal(R.dueDate('2026-10', 5), '2026-11-05');
  assert.equal(R.dueDate('2026-12', 10), '2027-01-10');
});

test('period states follow the dates', () => {
  const base = { periodKey: '2026-08', dueDay: 5 };
  assert.equal(R.periodState({ ...base, uploadedAt: '2026-09-04T10:00:00Z', na: false, today: '2026-11-06' }), 'on_time');
  assert.equal(R.periodState({ ...base, uploadedAt: '2026-09-09T10:00:00Z', na: false, today: '2026-11-06' }), 'late');
  assert.equal(R.periodState({ ...base, uploadedAt: null, na: false, today: '2026-11-06' }), 'missing');
  assert.equal(R.periodState({ ...base, uploadedAt: null, na: false, today: '2026-09-03' }), 'open');
  assert.equal(R.periodState({ periodKey: '2026-12', dueDay: 5, uploadedAt: null, na: false, today: '2026-11-06' }), 'upcoming');
  assert.equal(R.periodState({ ...base, uploadedAt: null, na: true, today: '2026-11-06' }), 'not_needed');
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

test('file type, size and empty files are refused', () => {
  assert.ok(R.fileErrors({ name: 'x.exe', size: 5 }).file);
  assert.ok(R.fileErrors({ name: 'x.pdf', size: 51 * 1024 * 1024 }).file);
  assert.ok(R.fileErrors({ name: 'x.pdf', size: 0 }).file);
  assert.ok(R.fileErrors(null).file);
  assert.deepEqual(R.fileErrors({ name: 'x.pdf', size: 5 }), {});
});

test('review actions follow the workflow', () => {
  const rev = { status: 'Submitted' as const, by: 'Sam', checker: 'Priya', approver: 'Tom' };
  assert.equal(R.canCheck(rev, 'Priya'), null);
  assert.match(R.canCheck(rev, 'Sam') as string, /cannot check/);
  assert.match(R.canCheck(rev, 'Tom') as string, /Only Priya/);
  assert.equal(R.canApprove({ ...rev, status: 'Checked' }, 'Tom'), null);
  assert.match(R.canApprove({ ...rev, status: 'Checked' }, 'Priya') as string, /differ/);
  assert.equal(R.canReturn(rev, 'Tom'), null);
  assert.match(R.canReturn(rev, 'Mia') as string, /Only the checker or approver/);
});

test('recurring uploads: owner or Records Lead only', () => {
  assert.equal(R.canUploadSeries('Mia', 'Mia', false), null);
  assert.equal(R.canUploadSeries('Mia', 'Sam', true), null);
  assert.match(R.canUploadSeries('Mia', 'Sam', false) as string, /Only Mia/);
});

test('removal is Records Lead only and needs a reason', () => {
  assert.match(R.canRemove(false) as string, /Records Lead/);
  assert.equal(R.canRemove(true), null);
  assert.ok(R.removeErrors('', 'short').reason);
  assert.ok(R.removeErrors('Created in error', 'short').text);
});

test('certificate renewal needs a future date', () => {
  assert.ok(R.renewalErrors({ file: { name: 'a.pdf', size: 3 }, summary: 'Renewed after inspection today', expiresOn: '2026-01-01', today: '2026-11-06' }).expiresOn);
  assert.deepEqual(R.renewalErrors({ file: { name: 'a.pdf', size: 3 }, summary: 'Renewed after inspection today', expiresOn: '2027-12-01', today: '2026-11-06' }), {});
});
