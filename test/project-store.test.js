import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProjectStore } from '../src/project-store.js';

const csv = [
  'name,Set,Collector Number,board,image URL,image Back URL',
  'Sol Ring,C21,263,mainboard,https://art.example/sol-ring.jpg,',
  'Sol Ring,C21,263,mainboard,https://art.example/sol-ring.jpg,',
].join('\n');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('imported copies and reviewed counts survive store recreation', () => {
  const storage = memoryStorage();
  const store = createProjectStore(storage);
  const imported = store.importCubeCsv(csv, { cubeId: 'cube-1' });
  const [first, second] = imported.cube.entries;
  assert.notEqual(first.copyId, second.copyId);

  const saved = store.reviewCopy(first.copyId, { wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });
  assert.equal(saved.status, 'saved');

  const reopened = createProjectStore(storage).getState();
  assert.equal(reopened.cubes[0].versions[0].entries[0].copyId, first.copyId);
  assert.equal(reopened.cycles[first.copyId][0].snapshots[0].wins, 10);
  assert.equal(reopened.cycles[second.copyId][0].snapshots.length, 0);
});

test('repeated totals remain zero-delta after reopening', () => {
  const storage = memoryStorage();
  const store = createProjectStore(storage);
  const imported = store.importCubeCsv(csv, { cubeId: 'cube-1' });
  const copyId = imported.cube.entries[0].copyId;
  store.reviewCopy(copyId, { wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });

  const reopened = createProjectStore(storage);
  const repeated = reopened.reviewCopy(copyId, { wins: 10, losses: 6, capturedAt: '2026-10-13T11:00:00Z' });
  assert.deepEqual(repeated.delta, { wins: 0, losses: 0 });
  assert.equal(reopened.getState().cycles[copyId][0].snapshots.length, 2);
});

test('an existing cube cannot be silently reimported with new physical-copy IDs', () => {
  const store = createProjectStore(memoryStorage());
  store.importCubeCsv(csv, { cubeId: 'cube-1' });
  assert.throws(() => store.importCubeCsv(csv, { cubeId: 'cube-1' }), /reconciliation/i);
  assert.equal(store.getState().cubes[0].versions.length, 1);
});

test('archived cycles and a fresh active cycle survive reopening', () => {
  const storage = memoryStorage();
  const store = createProjectStore(storage);
  const imported = store.importCubeCsv(csv, { cubeId: 'cube-1' });
  const copyId = imported.cube.entries[0].copyId;
  store.reviewCopy(copyId, { wins: 10, losses: 6, capturedAt: '2026-10-13T10:00:00Z' });
  store.archiveCopy(copyId, { archivedAt: '2026-10-13T12:00:00Z' });

  const reopened = createProjectStore(storage);
  const cycles = reopened.getState().cycles[copyId];
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].status, 'archived');
  assert.equal(cycles[0].snapshots[0].wins, 10);
  assert.equal(cycles[1].status, 'active');
  assert.deepEqual(reopened.reviewCopy(copyId, { wins: 2, losses: 1, capturedAt: '2026-10-14T10:00:00Z' }).delta, { wins: 2, losses: 1 });
});

test('physical Games and Wins marks become wins and derived losses', () => {
  const store = createProjectStore(memoryStorage());
  const imported = store.importCubeCsv(csv, { cubeId: 'cube-1' });
  const copyId = imported.cube.entries[0].copyId;

  const first = store.reviewGameMarks(copyId, { games: 10, wins: 6, capturedAt: '2026-10-13T10:00:00Z' });
  const second = store.reviewGameMarks(copyId, { games: 12, wins: 7, capturedAt: '2026-10-13T11:00:00Z' });

  assert.deepEqual(first.delta, { wins: 6, losses: 4 });
  assert.deepEqual(second.delta, { wins: 1, losses: 1 });
  assert.equal(store.getState().cycles[copyId][0].snapshots.at(-1).losses, 5);
  assert.throws(() => store.reviewGameMarks(copyId, { games: 10, wins: 11, capturedAt: '2026-10-13T12:00:00Z' }), /wins/i);
  assert.throws(() => store.reviewGameMarks(copyId, { games: 51, wins: 0, capturedAt: '2026-10-13T12:00:00Z' }), /50/i);
});
