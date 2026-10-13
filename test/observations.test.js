import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrackingCycle, reviewSnapshot } from '../src/observations.js';

test('cumulative reviewed counts add only the difference within a cycle', () => {
  const start = createTrackingCycle({ copyId: 'copy-1' });
  const first = reviewSnapshot(start, { snapshotId: 'scan-1', wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });
  const second = reviewSnapshot(first.cycle, { snapshotId: 'scan-2', wins: 12, losses: 7, capturedAt: '2026-10-13T11:00:00Z' });

  assert.equal(first.status, 'saved');
  assert.deepEqual(first.delta, { wins: 10, losses: 6 });
  assert.deepEqual(second.delta, { wins: 2, losses: 1 });
  assert.equal(second.cycle.snapshots.length, 2);
  assert.equal(second.cycle.copyId, 'copy-1');
});

test('repeating reviewed totals or the same snapshot never inflates the record', () => {
  const start = createTrackingCycle({ copyId: 'copy-1' });
  const first = reviewSnapshot(start, { snapshotId: 'scan-1', wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });
  const sameTotals = reviewSnapshot(first.cycle, { snapshotId: 'scan-2', wins: 10, losses: 6, capturedAt: '2026-10-13T11:00:00Z' });
  const repeatedId = reviewSnapshot(sameTotals.cycle, { snapshotId: 'scan-1', wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });

  assert.deepEqual(sameTotals.delta, { wins: 0, losses: 0 });
  assert.equal(repeatedId.status, 'duplicate');
  assert.equal(repeatedId.cycle.snapshots.length, 2);
});

test('lower totals are flagged without changing accepted history', () => {
  const start = createTrackingCycle({ copyId: 'copy-1' });
  const first = reviewSnapshot(start, { snapshotId: 'scan-1', wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });
  const lower = reviewSnapshot(first.cycle, { snapshotId: 'scan-2', wins: 9, losses: 6, capturedAt: '2026-10-13T11:00:00Z' });

  assert.equal(lower.status, 'needs-review');
  assert.equal(lower.cycle, first.cycle);
  assert.equal(lower.cycle.snapshots.length, 1);
});

test('counts must be non-negative integers and snapshot IDs cannot be reused with different totals', () => {
  const start = createTrackingCycle({ copyId: 'copy-1' });
  assert.throws(() => reviewSnapshot(start, { snapshotId: 'bad', wins: -1, losses: 0, capturedAt: '2026-10-13T10:00:00Z' }), /wins/i);
  assert.throws(() => reviewSnapshot(start, { snapshotId: 'bad', wins: 0.5, losses: 0, capturedAt: '2026-10-13T10:00:00Z' }), /wins/i);
  const first = reviewSnapshot(start, { snapshotId: 'scan-1', wins: 1, losses: 0, capturedAt: '2026-10-13T10:00:00Z' });
  assert.throws(() => reviewSnapshot(first.cycle, { snapshotId: 'scan-1', wins: 2, losses: 0, capturedAt: '2026-10-13T10:00:00Z' }), /snapshot/i);
});
