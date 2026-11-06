import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/domain/activity.ts';

test('audit entries are attributed to a project by document, or by the code in a project entry', () => {
  const docProject = { 'U100-PID-1001': 'U100' };
  assert.equal(A.projectOf({ when: '', docNumber: 'U100-PID-1001', detail: '' }, docProject, ['U100', 'TF7']), 'U100');
  assert.equal(A.projectOf({ when: '', docNumber: '', detail: 'TF7 · Tank Farm' }, docProject, ['U100', 'TF7']), 'TF7');
  assert.equal(A.projectOf({ when: '', docNumber: '', detail: 'something else' }, docProject, ['U100', 'TF7']), null);
});

test('daily counts group by project and day, for one month or one year', () => {
  const entries = [
    { when: '2026-11-03T09:00:00Z', project: 'U100' },
    { when: '2026-11-03T14:00:00Z', project: 'U100' },
    { when: '2026-11-05T10:00:00Z', project: 'TF7' },
    { when: '2026-10-05T10:00:00Z', project: 'TF7' },
    { when: '2026-11-07T10:00:00Z', project: null },
  ];
  const m = A.dailyCounts(entries, '2026-11');
  assert.equal(m.get('U100')!.get('2026-11-03'), 2);
  assert.equal(m.get('TF7')!.get('2026-10-05'), undefined, 'other month excluded');
  assert.equal(A.dailyCounts(entries, '2026').get('TF7')!.size, 2);
});

test('heat levels run 0 to 4, scaled to the busiest cell', () => {
  assert.equal(A.heatLevel(0, 10), 0);
  assert.equal(A.heatLevel(1, 10), 1);
  assert.equal(A.heatLevel(10, 10), 4);
  assert.equal(A.heatLevel(5, 10), 2);
});

test('a month has the right number of days', () => {
  assert.equal(A.daysOfMonth('2026-02').length, 28);
  assert.equal(A.daysOfMonth('2028-02').length, 29);
  assert.equal(A.daysOfMonth('2026-11')[29], '2026-11-30');
});
