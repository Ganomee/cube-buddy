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

test('versioned local backup restores cube mappings and reviewed cycles without replacing existing data', () => {
  const source = createProjectStore(memoryStorage());
  const imported = source.importCubeCsv(csv, { cubeId: 'cube-1' });
  const copyId = imported.cube.entries[0].copyId;
  source.reviewGameMarks(copyId, { games: 10, wins: 6, capturedAt: '2026-10-13T10:00:00Z' });
  source.archiveCopy(copyId, { archivedAt: '2026-10-13T11:00:00Z' });

  const backup = source.exportBackup({ exportedAt: '2026-10-13T12:00:00Z' });
  const parsed = JSON.parse(backup);
  assert.equal(parsed.format, 'cube-buddy-backup');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.project.cubes[0].versions[0].entries[0].source['collector number'], '263');

  const destination = createProjectStore(memoryStorage());
  destination.restoreBackup(backup);
  assert.deepEqual(destination.getState(), source.getState());
  assert.throws(() => destination.restoreBackup(backup), /empty project/i);
  assert.throws(() => createProjectStore(memoryStorage()).restoreBackup('{"format":"other"}'), /backup/i);
});

test('reimport retains unique physical copies, requires duplicate mapping, and preserves removed history', () => {
  const store = createProjectStore(memoryStorage());
  const originalCsv = 'name,Set,Collector Number\nSol Ring,C21,263\nLightning Bolt,2XM,116\nLightning Bolt,2XM,116\nForest,M21,273';
  const first = store.importCubeCsv(originalCsv, { cubeId: 'cube-1' }).cube.entries;
  const updatedCsv = 'name,Set,Collector Number\nSol Ring,C21,263\nLightning Bolt,2XM,116\nLightning Bolt,2XM,116\nIsland,M21,265';

  const pending = store.reimportCubeCsv(updatedCsv, { cubeId: 'cube-1' });
  assert.equal(pending.status, 'needs-review');
  assert.equal(pending.ambiguous.length, 2);
  assert.equal(store.getState().cubes[0].versions.length, 1);

  const saved = store.reimportCubeCsv(updatedCsv, { cubeId: 'cube-1', matches: { 3: first[1].copyId, 4: first[2].copyId } });
  assert.equal(saved.status, 'saved');
  const next = store.getState().cubes[0].versions[1].entries;
  assert.equal(next[0].copyId, first[0].copyId);
  assert.equal(next[1].copyId, first[1].copyId);
  assert.equal(next[2].copyId, first[2].copyId);
  assert.notEqual(next[3].copyId, first[3].copyId);
  assert.equal(store.getState().cycles[first[3].copyId].length, 1);
  assert.equal(store.getState().cubes[0].activeVersionId, saved.versionId);
});

test('a changed printing for the same card waits for physical-copy review', () => {
  const store = createProjectStore(memoryStorage());
  const original = store.importCubeCsv('name,Set,Collector Number\nSol Ring,C21,263', { cubeId: 'cube-1' }).cube.entries[0];
  const changed = store.reimportCubeCsv('name,Set,Collector Number\nSol Ring,2XM,270', { cubeId: 'cube-1' });
  assert.equal(changed.status, 'needs-review');
  assert.deepEqual(changed.ambiguous[0].candidateCopyIds, [original.copyId]);
  assert.equal(store.getState().cubes[0].versions.length, 1);
});
