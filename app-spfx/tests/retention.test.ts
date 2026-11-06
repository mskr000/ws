import test from 'node:test';
import assert from 'node:assert/strict';
import * as RT from '../src/domain/retention.ts';
import { auditCsv } from '../src/domain/audit.ts';

test('retention runs from the last activity, not the upload', () => {
  assert.equal(RT.retentionUntil('2026-02-03', 7), '2033-02-03');
  assert.equal(RT.lastActivity(['2026-02-03', '2026-04-10T09:00:00Z', null], '2026-11-06'), '2026-04-10');
  assert.equal(RT.lastActivity([], '2026-11-06'), '2026-11-06');
});

test('a document on legal hold cannot be removed, whatever its age', () => {
  assert.match(RT.removalBlock({ legalHold: true, lastActivityDay: '2000-01-01', today: '2026-11-06' }) as string, /Legal hold/);
});

test('a document inside retention cannot be removed; after it, it can', () => {
  assert.match(RT.removalBlock({ legalHold: false, lastActivityDay: '2026-02-03', today: '2026-11-06' }) as string, /keep until 2033-02-03/);
  assert.equal(RT.removalBlock({ legalHold: false, lastActivityDay: '2018-02-03', today: '2026-11-06' }), null);
});

test('hold reason needs a real sentence', () => {
  assert.ok(RT.holdErrors('short').reason);
  assert.deepEqual(RT.holdErrors('Dispute with the vendor'), {});
});

test('audit export: one line per entry, oldest first, formulas neutralised', () => {
  const csv = auditCsv([
    { when: '2026-04-10T14:20:00Z', who: 'Tom', action: 'Approved', docNumber: 'U100-PID-1001', detail: 'rev 1' },
    { when: '2026-02-03T09:00:00Z', who: 'Sam', action: 'Created', docNumber: 'U100-PID-1001', detail: '=HYPERLINK("x")' },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^2026-02-03/);
  assert.match(lines[1], /'=HYPERLINK/);
});
