import { newId } from './ids.js';
import { importCubeCobraCsv } from './cube-cobra-import.js';
import { archiveAndResetCycle, createTrackingCycle, reviewSnapshot } from './observations.js';

const STORAGE_KEY = 'cube-buddy-project-v1';

function validateBackupProject(project) {
  if (!project || project.schemaVersion !== 1 || !Array.isArray(project.cubes) || !project.cycles || typeof project.cycles !== 'object' || Array.isArray(project.cycles)) {
    throw new Error('Invalid Cube Buddy backup project');
  }
  const cubeIds = new Set();
  const copyIds = new Set();
  for (const cube of project.cubes) {
    if (!cube || typeof cube.cubeId !== 'string' || !Array.isArray(cube.versions) || cubeIds.has(cube.cubeId) || !cube.versions.some((version) => version.versionId === cube.activeVersionId)) {
      throw new Error('Invalid cube in Cube Buddy backup');
    }
    cubeIds.add(cube.cubeId);
    for (const version of cube.versions) {
      if (!Array.isArray(version.entries)) throw new Error('Invalid cube version in Cube Buddy backup');
      for (const entry of version.entries) {
        if (!entry || typeof entry.copyId !== 'string' || !entry.copyId || typeof entry.cardId !== 'string') {
          throw new Error('Invalid physical copy in Cube Buddy backup');
        }
        copyIds.add(entry.copyId);
      }
    }
  }
  if (Object.keys(project.cycles).some((copyId) => !copyIds.has(copyId)) || [...copyIds].some((copyId) => !Array.isArray(project.cycles[copyId]) || project.cycles[copyId].length === 0)) {
    throw new Error('Backup cycles do not match physical copies');
  }
  for (const [copyId, cycles] of Object.entries(project.cycles)) {
    for (const cycle of cycles) {
      if (!cycle || cycle.copyId !== copyId || typeof cycle.cycleId !== 'string' || !Array.isArray(cycle.snapshots) || !['active', 'archived'].includes(cycle.status)) {
        throw new Error('Invalid tracking cycle in Cube Buddy backup');
      }
      for (const snapshot of cycle.snapshots) {
        if (snapshot.copyId !== copyId || snapshot.cycleId !== cycle.cycleId || !Number.isSafeInteger(snapshot.wins) || snapshot.wins < 0 || !Number.isSafeInteger(snapshot.losses) || snapshot.losses < 0 || !Number.isFinite(Date.parse(snapshot.capturedAt))) {
          throw new Error('Invalid reviewed snapshot in Cube Buddy backup');
        }
      }
    }
  }
}

export function createProjectStore(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('A storage provider with getItem and setItem is required');
  }

  const saved = storage.getItem(STORAGE_KEY);
  let state = saved ? JSON.parse(saved) : { schemaVersion: 1, cubes: [], cycles: {} };
  if (state.schemaVersion !== 1 || !Array.isArray(state.cubes) || !state.cycles || typeof state.cycles !== 'object') {
    throw new Error('Unsupported or invalid local project data');
  }

  const commit = (next) => {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
  };

  return {
    getState() {
      return structuredClone(state);
    },

    exportBackup({ exportedAt } = {}) {
      if (typeof exportedAt !== 'string' || !Number.isFinite(Date.parse(exportedAt))) {
        throw new TypeError('An exportedAt date is required');
      }
      return JSON.stringify({ format: 'cube-buddy-backup', version: 1, exportedAt, project: state }, null, 2);
    },

    restoreBackup(json) {
      if (state.cubes.length || Object.keys(state.cycles).length) {
        throw new Error('Restore requires an empty project');
      }
      let backup;
      try {
        backup = JSON.parse(json);
      } catch {
        throw new Error('Invalid Cube Buddy backup JSON');
      }
      if (!backup || backup.format !== 'cube-buddy-backup' || backup.version !== 1) {
        throw new Error('Unsupported Cube Buddy backup');
      }
      validateBackupProject(backup.project);
      commit(backup.project);
      return this.getState();
    },

    importCubeCsv(csv, { cubeId } = {}) {
      if (state.cubes.some((cube) => cube.cubeId === cubeId)) {
        throw new Error('An existing cube needs physical-copy reconciliation before reimport');
      }
      const imported = importCubeCobraCsv(csv, { cubeId, versionId: newId() });
      const cube = { cubeId, activeVersionId: imported.cube.versionId, versions: [imported.cube] };
      const cycles = { ...state.cycles };
      for (const entry of imported.cube.entries) {
        cycles[entry.copyId] = [createTrackingCycle({ copyId: entry.copyId })];
      }
      commit({ ...state, cubes: [...state.cubes, cube], cycles });
      return imported;
    },

    reviewCopy(copyId, reviewed) {
      const history = state.cycles[copyId];
      if (!Array.isArray(history) || history.length === 0) throw new Error('Unknown physical copy ID');
      const result = reviewSnapshot(history.at(-1), reviewed);
      if (result.status === 'saved') {
        commit({
          ...state,
          cycles: { ...state.cycles, [copyId]: [...history.slice(0, -1), result.cycle] },
        });
      }
      return result;
    },

    reviewGameMarks(copyId, { games, wins, capturedAt }) {
      if (!Number.isSafeInteger(games) || games < 0 || games > 50) {
        throw new RangeError('Games must be a whole number from 0 to 50');
      }
      if (!Number.isSafeInteger(wins) || wins < 0 || wins > games) {
        throw new RangeError('Wins must be a whole number from 0 to Games');
      }
      return this.reviewCopy(copyId, { wins, losses: games - wins, capturedAt });
    },

    archiveCopy(copyId, options) {
      const history = state.cycles[copyId];
      if (!Array.isArray(history) || history.length === 0) throw new Error('Unknown physical copy ID');
      const result = archiveAndResetCycle(history.at(-1), options);
      commit({
        ...state,
        cycles: { ...state.cycles, [copyId]: [...history.slice(0, -1), result.archivedCycle, result.nextCycle] },
      });
      return result;
    },
  };
}
