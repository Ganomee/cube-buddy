import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTrackingCycle, reviewSnapshot, archiveAndResetCycle } from '../src/observations.js';

test('archive and reset preserves history and starts independent counts for the same copy', () => {
  const start = createTrackingCycle({ copyId: 'copy-1' });
  const reviewed = reviewSnapshot(start, { snapshotId: 'scan-1', wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });
  const { archivedCycle, nextCycle } = archiveAndResetCycle(reviewed.cycle, { archivedAt: '2026-10-13T12:00:00Z' });
  const newReview = reviewSnapshot(nextCycle, { snapshotId: 'scan-2', wins: 2, losses: 1, capturedAt: '2026-10-14T10:00:00Z' });

  assert.equal(archivedCycle.status, 'archived');
  assert.equal(archivedCycle.snapshots.length, 1);
  assert.equal(archivedCycle.snapshots[0].wins, 10);
  assert.equal(nextCycle.copyId, 'copy-1');
  assert.notEqual(nextCycle.cycleId, archivedCycle.cycleId);
  assert.deepEqual(newReview.delta, { wins: 2, losses: 1 });
});

test('reset rejects an already archived cycle and reviewed snapshots cannot enter it', () => {
  const start = createTrackingCycle({ copyId: 'copy-1' });
  const { archivedCycle } = archiveAndResetCycle(start, { archivedAt: '2026-10-13T12:00:00Z' });

  assert.throws(() => archiveAndResetCycle(archivedCycle, { archivedAt: '2026-10-13T13:00:00Z' }), /archived/i);
  assert.throws(() => reviewSnapshot(archivedCycle, { snapshotId: 'scan-1', wins: 1, losses: 0, capturedAt: '2026-10-13T13:00:00Z' }), /archived/i);
});
