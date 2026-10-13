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

function sourceKey(entry) {
  return JSON.stringify(Object.entries(entry.source).sort(([a], [b]) => a.localeCompare(b)));
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

    reimportCubeCsv(csv, { cubeId, matches = {} } = {}) {
      const cubeIndex = state.cubes.findIndex((cube) => cube.cubeId === cubeId);
      if (cubeIndex < 0) throw new Error('Unknown cube');
      const cube = state.cubes[cubeIndex];
      const previous = cube.versions.find((version) => version.versionId === cube.activeVersionId);
      const imported = importCubeCobraCsv(csv, { cubeId, versionId: newId() });
      const oldByKey = new Map();
      const oldByName = new Map();
      const newByKey = new Map();
      const oldCardByName = new Map();
      for (const entry of previous.entries) {
        const key = sourceKey(entry);
        oldByKey.set(key, [...(oldByKey.get(key) ?? []), entry]);
        if (entry.name) {
          const name = entry.name.toLowerCase();
          oldByName.set(name, [...(oldByName.get(name) ?? []), entry]);
          oldCardByName.set(name, entry.cardId);
        }
      }
      for (const entry of imported.cube.entries) {
        const key = sourceKey(entry);
        newByKey.set(key, [...(newByKey.get(key) ?? []), entry]);
      }

      const ambiguous = [];
      const retained = new Set();
      const entries = imported.cube.entries.map((entry) => {
        const key = sourceKey(entry);
        const oldGroup = oldByKey.get(key) ?? [];
        const candidates = oldGroup.length ? oldGroup : (oldByName.get(entry.name.toLowerCase()) ?? []);
        const newGroup = newByKey.get(key);
        const explicit = Object.hasOwn(matches, entry.sourceRow);
        let prior;
        if (explicit) {
          const choice = matches[entry.sourceRow];
          if (choice !== 'new') {
            prior = candidates.find((item) => item.copyId === choice);
            if (!prior || retained.has(choice)) throw new Error(`Invalid or repeated physical-copy match for CSV row ${entry.sourceRow}`);
          }
        } else if (oldGroup.length === 1 && newGroup.length === 1) {
          prior = oldGroup[0];
        } else if (candidates.length > 0) {
          ambiguous.push({
            sourceRow: entry.sourceRow,
            name: entry.name,
            incomingPrinting: entry.printing,
            incomingArtwork: entry.artwork,
            candidateCopyIds: candidates.map((item) => item.copyId),
            candidatePrintings: Object.fromEntries(candidates.map((item) => [item.copyId, item.printing])),
            candidateArtworks: Object.fromEntries(candidates.map((item) => [item.copyId, item.artwork])),
          });
        }
        if (prior) {
          if (retained.has(prior.copyId)) throw new Error(`Physical copy ${prior.copyId} was matched more than once`);
          retained.add(prior.copyId);
        }
        return {
          ...entry,
          cardId: prior?.cardId ?? oldCardByName.get(entry.name.toLowerCase()) ?? entry.cardId,
          copyId: prior?.copyId ?? entry.copyId,
        };
      });
      if (ambiguous.length) return { status: 'needs-review', ambiguous, review: imported.review };

      const version = { ...imported.cube, entries };
      const cycles = { ...state.cycles };
      for (const entry of entries) {
        if (!cycles[entry.copyId]) cycles[entry.copyId] = [createTrackingCycle({ copyId: entry.copyId })];
      }
      const updatedCube = { ...cube, activeVersionId: version.versionId, versions: [...cube.versions, version] };
      const cubes = [...state.cubes];
      cubes[cubeIndex] = updatedCube;
      commit({ ...state, cubes, cycles });
      return { status: 'saved', versionId: version.versionId, retainedCopyIds: [...retained], removedCopyIds: previous.entries.filter((entry) => !entries.some((next) => next.copyId === entry.copyId)).map((entry) => entry.copyId), review: imported.review };
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
