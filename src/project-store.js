import { randomUUID } from 'node:crypto';
import { importCubeCobraCsv } from './cube-cobra-import.js';
import { createTrackingCycle, reviewSnapshot } from './observations.js';

const STORAGE_KEY = 'cube-buddy-project-v1';

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

    importCubeCsv(csv, { cubeId } = {}) {
      if (state.cubes.some((cube) => cube.cubeId === cubeId)) {
        throw new Error('An existing cube needs physical-copy reconciliation before reimport');
      }
      const imported = importCubeCobraCsv(csv, { cubeId, versionId: randomUUID() });
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

    archiveCopy() {
      throw new Error('Persisted cycle reset is not implemented');
    },
  };
}
