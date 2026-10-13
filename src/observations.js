import { newId } from './ids.js';

export function createTrackingCycle({ copyId } = {}) {
  if (typeof copyId !== 'string' || copyId.trim() === '') {
    throw new TypeError('A copyId is required');
  }
  return { cycleId: newId(), copyId, status: 'active', snapshots: [] };
}

export function reviewSnapshot(cycle, { snapshotId = newId(), wins, losses, capturedAt } = {}) {
  if (!cycle || !Array.isArray(cycle.snapshots) || !cycle.cycleId || !cycle.copyId) {
    throw new TypeError('A valid tracking cycle is required');
  }
  if (cycle.status === 'archived') {
    throw new Error('An archived tracking cycle cannot accept snapshots');
  }
  if (typeof snapshotId !== 'string' || snapshotId.trim() === '') {
    throw new TypeError('A snapshotId is required');
  }
  for (const [label, count] of [['wins', wins], ['losses', losses]]) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new TypeError(`${label} must be a non-negative integer`);
    }
  }
  if (typeof capturedAt !== 'string' || !Number.isFinite(Date.parse(capturedAt))) {
    throw new TypeError('A capturedAt date is required');
  }

  const previousSubmission = cycle.snapshots.find((snapshot) => snapshot.snapshotId === snapshotId);
  if (previousSubmission) {
    if (previousSubmission.wins !== wins || previousSubmission.losses !== losses || previousSubmission.capturedAt !== capturedAt) {
      throw new Error('Snapshot ID was already used with different reviewed values');
    }
    return { status: 'duplicate', cycle, delta: { wins: 0, losses: 0 } };
  }

  const previous = cycle.snapshots.at(-1);
  const priorWins = previous?.wins ?? 0;
  const priorLosses = previous?.losses ?? 0;
  if (wins < priorWins || losses < priorLosses) {
    return { status: 'needs-review', cycle, proposed: { wins, losses, capturedAt } };
  }

  const delta = { wins: wins - priorWins, losses: losses - priorLosses };
  const snapshot = {
    snapshotId,
    cycleId: cycle.cycleId,
    copyId: cycle.copyId,
    wins,
    losses,
    capturedAt,
    delta,
  };
  return {
    status: 'saved',
    delta,
    snapshot,
    cycle: { ...cycle, snapshots: [...cycle.snapshots, snapshot] },
  };
}

export function archiveAndResetCycle(cycle, { archivedAt } = {}) {
  if (!cycle || !Array.isArray(cycle.snapshots) || !cycle.cycleId || !cycle.copyId) {
    throw new TypeError('A valid tracking cycle is required');
  }
  if (cycle.status === 'archived') {
    throw new Error('Tracking cycle is already archived');
  }
  if (typeof archivedAt !== 'string' || !Number.isFinite(Date.parse(archivedAt))) {
    throw new TypeError('An archivedAt date is required');
  }

  return {
    archivedCycle: { ...cycle, status: 'archived', archivedAt },
    nextCycle: createTrackingCycle({ copyId: cycle.copyId }),
  };
}
