import test from 'node:test';
import assert from 'node:assert/strict';
import * as SR from '../src/domain/series.ts';

const today = '2026-11-06';

test('an active series makes every month due from its start', () => {
  assert.deepEqual(SR.dueMonths({ startPeriod: '2026-09' }, today), ['2026-09', '2026-10', '2026-11']);
});

test('pausing stops months from being due; resuming starts them again', () => {
  let s = SR.pause({ startPeriod: '2026-08' }, '2026-09');
  assert.equal(SR.seriesStatus(s, '2026-10'), 'paused');
  assert.deepEqual(SR.dueMonths(s, today), ['2026-08']);
  s = SR.resume(s, '2026-11');
  assert.equal(SR.seriesStatus(s, '2026-11'), 'active');
  assert.deepEqual(SR.dueMonths(s, today), ['2026-08', '2026-11']);
});

test('ending a series stops months after the end month; nothing else changes', () => {
  const s = SR.end({ startPeriod: '2026-06' }, '2026-08');
  assert.equal(SR.seriesStatus(s, '2026-09'), 'ended');
  assert.deepEqual(SR.dueMonths(s, today), ['2026-06', '2026-07', '2026-08']);
});

test('stopping in the current month shows as stopped at once', () => {
  const s = SR.end({ startPeriod: '2026-06' }, '2026-11');
  assert.equal(SR.seriesStatus(s, '2026-11'), 'ended');
});

test('a paused series cannot be ended by pausing again, and ending keeps the history of the start', () => {
  const ended = SR.end({ startPeriod: '2026-06' }, '2026-08');
  assert.equal(SR.pause(ended, '2026-09').pausedFrom, undefined);
  assert.equal(SR.dueMonths({ startPeriod: null }, today).length, 0);
});
