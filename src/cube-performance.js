const METRIC = 'player-selected relevant-game outcomes';

function totalsForCopy(cycles = []) {
  const totals = { wins: 0, losses: 0, outcomes: 0 };
  let lastCaptureAt = null;
  for (const cycle of cycles) {
    const latest = cycle.snapshots.at(-1);
    if (!latest) continue;
    totals.wins += latest.wins;
    totals.losses += latest.losses;
    totals.outcomes += latest.wins + latest.losses;
    if (!lastCaptureAt || latest.capturedAt > lastCaptureAt) lastCaptureAt = latest.capturedAt;
  }
  return { totals, lastCaptureAt };
}

export function getCubePerformance(state, cubeId) {
  const cube = state.cubes.find((item) => item.cubeId === cubeId);
  if (!cube) throw new Error('Unknown cube');
  const version = cube.versions.find((item) => item.versionId === cube.activeVersionId);
  if (!version) throw new Error('Active cube version is missing');

  const cardsById = new Map();
  for (const entry of version.entries) {
    const copy = { copyId: entry.copyId, ...totalsForCopy(state.cycles[entry.copyId]) };
    let card = cardsById.get(entry.cardId);
    if (!card) {
      card = {
        cardId: entry.cardId,
        name: entry.name,
        metric: METRIC,
        copyCount: 0,
        copies: [],
        totals: { wins: 0, losses: 0, outcomes: 0 },
        rate: null,
        lastCaptureAt: null,
      };
      cardsById.set(entry.cardId, card);
    }
    card.copyCount++;
    card.copies.push(copy);
    card.totals.wins += copy.totals.wins;
    card.totals.losses += copy.totals.losses;
    card.totals.outcomes += copy.totals.outcomes;
    if (!card.lastCaptureAt || (copy.lastCaptureAt && copy.lastCaptureAt > card.lastCaptureAt)) {
      card.lastCaptureAt = copy.lastCaptureAt;
    }
  }
  for (const card of cardsById.values()) {
    card.rate = card.totals.outcomes ? card.totals.wins / card.totals.outcomes : null;
  }

  return { cubeId, versionId: version.versionId, cards: [...cardsById.values()] };
}
