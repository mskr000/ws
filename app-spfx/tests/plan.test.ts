import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/domain/calendar.ts';
import * as M from '../src/domain/master.ts';

test('calendar: twelve cells, before the start, then each month by its state', () => {
  const cells = C.yearCells({ startPeriod: '2026-06', dueDay: 5 }, [
    { periodKey: '2026-06', notNeeded: false, uploadedAt: '2026-07-03T10:00:00Z' },
    { periodKey: '2026-07', notNeeded: false, uploadedAt: '2026-08-09T10:00:00Z' },
    { periodKey: '2026-08', notNeeded: true, uploadedAt: null },
  ], 2026, '2026-11-06');
  assert.equal(cells.length, 12);
  assert.equal(cells[0].state, 'before');
  assert.equal(cells[5].state, 'on_time');   // June
  assert.equal(cells[6].state, 'late');      // July
  assert.equal(cells[7].state, 'not_needed'); // August
  assert.equal(cells[8].state, 'missing');   // September
  assert.equal(cells[9].state, 'missing');   // October
  assert.equal(cells[10].state, 'open');     // November, due 5 December
  assert.equal(cells[11].state, 'upcoming'); // December
});

test('master list: empty folders stay in the list; documents show where they stand', () => {
  const folders = ['Engineering/Drawings', 'Operations/Monthly reports', 'Finance/Budget'];
  const docs: M.MasterDoc[] = [
    { id: 1, number: 'U100-PID-1001', title: 'Pump layout', kind: 'controlled', folder: 'Engineering/Drawings', removed: false },
    { id: 2, number: 'U100-RPT-0001', title: 'Monthly report', kind: 'periodic', folder: 'Operations/Monthly reports', removed: false },
  ];
  const rows = M.masterList(folders, docs, [{ documentId: 1, n: 1, status: 'Approved', createdAt: '2026-04-10' }], [], [], '2026-11-06');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].rows[0].standing, 'Current: rev 1');
  assert.equal(rows[0].rows[0].attention, false);
  // sorted: Engineering, Finance (empty), Operations
  assert.equal(rows[2].rows[0].standing, 'Nothing uploaded yet');
  assert.equal(rows[2].rows[0].attention, true);
  assert.equal(rows[1].rows.length, 0, 'empty folder kept');
});

test('master list: a controlled document with a rev under review needs attention', () => {
  const s = M.standingOf({ id: 1, number: 'X', title: 't', kind: 'controlled', folder: 'f', removed: false },
    [{ documentId: 1, n: 0, status: 'Approved', createdAt: '' }, { documentId: 1, n: 1, status: 'Submitted', createdAt: '' }], [], [], '2026-11-06');
  assert.match(s.text, /Current: rev 0\. Rev 1 is submitted/);
  assert.equal(s.attention, true);
});
