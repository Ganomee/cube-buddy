import assert from 'node:assert/strict';
import test from 'node:test';
import { planResidualContributions } from '../src/cube-cobra-record-sync.js';

test('plans one-card decks for performance not already represented by real decks', () => {
  const desired = [
    { oracleId: 'card-a', games: 10, wins: 6 },
    { oracleId: 'card-b', games: 4, wins: 1 },
  ];
  const existing = [
    { playerName: 'Alice', oracleIds: ['card-a', 'card-b'], wins: 1, losses: 1, draws: 0 },
    { playerName: 'Cube Buddy · card-a', oracleIds: ['card-a'], wins: 2, losses: 1, draws: 0 },
  ];

  assert.deepEqual(planResidualContributions(desired, existing), [
    { playerName: 'Cube Buddy · card-a', oracleIds: ['card-a'], wins: 5, losses: 3, draws: 0 },
    { playerName: 'Cube Buddy · card-b', oracleIds: ['card-b'], wins: 0, losses: 2, draws: 0 },
  ]);
});

test('flags impossible residuals instead of uploading negative results', () => {
  const result = planResidualContributions(
    [{ oracleId: 'card-a', games: 1, wins: 0 }],
    [{ playerName: 'Alice', oracleIds: ['card-a'], wins: 1, losses: 1, draws: 0 }],
  );
  assert.deepEqual(result, [{ oracleId: 'card-a', status: 'needs-review', reason: 'Cube Cobra already contains more outcomes than Cube Buddy' }]);
});
