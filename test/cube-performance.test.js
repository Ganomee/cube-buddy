import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCubePerformance } from '../src/cube-performance.js';

const state = {
  schemaVersion: 1,
  cubes: [{
    cubeId: 'cube-1',
    activeVersionId: 'v1',
    versions: [{
      cubeId: 'cube-1', versionId: 'v1', entries: [
        { cardId: 'card-a', copyId: 'copy-a1', name: 'Sol Ring' },
        { cardId: 'card-a', copyId: 'copy-a2', name: 'Sol Ring' },
        { cardId: 'card-b', copyId: 'copy-b1', name: 'Island' },
      ],
    }],
  }],
  cycles: {
    'copy-a1': [
      { cycleId: 'old', status: 'archived', snapshots: [
        { wins: 2, losses: 1, capturedAt: '2026-10-01T10:00:00Z' },
        { wins: 3, losses: 1, capturedAt: '2026-10-02T10:00:00Z' },
      ] },
      { cycleId: 'new', status: 'active', snapshots: [
        { wins: 1, losses: 2, capturedAt: '2026-10-13T10:00:00Z' },
      ] },
    ],
    'copy-a2': [{ cycleId: 'second', status: 'active', snapshots: [
      { wins: 0, losses: 1, capturedAt: '2026-10-12T10:00:00Z' },
    ] }],
    'copy-b1': [{ cycleId: 'empty', status: 'active', snapshots: [] }],
  },
};

test('cube performance uses the last reviewed cumulative totals per cycle', () => {
  const view = getCubePerformance(state, 'cube-1');
  const solRing = view.cards.find((card) => card.cardId === 'card-a');

  assert.deepEqual(solRing.totals, { wins: 4, losses: 4, outcomes: 8 });
  assert.equal(solRing.rate, 0.5);
  assert.equal(solRing.copyCount, 2);
  assert.equal(solRing.lastCaptureAt, '2026-10-13T10:00:00Z');
  assert.equal(solRing.metric, 'player-selected relevant-game outcomes');
});

test('unobserved cards have no rate and are not treated as losses', () => {
  const view = getCubePerformance(state, 'cube-1');
  const island = view.cards.find((card) => card.cardId === 'card-b');

  assert.deepEqual(island.totals, { wins: 0, losses: 0, outcomes: 0 });
  assert.equal(island.rate, null);
  assert.equal(island.lastCaptureAt, null);
});
