import assert from 'node:assert/strict';
import test from 'node:test';
import { planResidualContributions, syncCubeCobraResiduals } from '../src/cube-cobra-record-sync.js';

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

test('syncs overlapping 10-match and 8-match decks with independent card residuals', async () => {
  const existing = [
    { playerName: 'Ten match deck', oracleIds: ['card-a', 'card-b'], wins: 6, losses: 4, draws: 0 },
    { playerName: 'Eight match deck', oracleIds: ['card-b', 'card-c'], wins: 5, losses: 3, draws: 0 },
    { playerName: 'Cube Buddy · card-b', oracleIds: ['card-b'], wins: 99, losses: 99, draws: 0 },
  ];
  const submitted = [];
  const result = await syncCubeCobraResiduals('share-link', [
    { oracleId: 'card-a', games: 13, wins: 8 },
    { oracleId: 'card-b', games: 22, wins: 13 },
    { oracleId: 'card-c', games: 9, wins: 5 },
  ], {
    reader: async () => ({ contributions: existing }),
    submitter: async (_link, contribution) => { submitted.push(contribution); return contribution; },
  });

  assert.equal(result.status, 'applied');
  assert.deepEqual(submitted.map(({ playerName, wins, losses }) => ({ playerName, wins, losses })), [
    { playerName: 'Cube Buddy · card-a', wins: 2, losses: 1 },
    { playerName: 'Cube Buddy · card-b', wins: 2, losses: 2 },
    { playerName: 'Cube Buddy · card-c', wins: 0, losses: 1 },
  ]);
});

test('sync applies nothing when any card needs human review', async () => {
  let submissions = 0;
  const result = await syncCubeCobraResiduals('share-link', [{ oracleId: 'card-a', games: 1, wins: 0 }], {
    reader: async () => ({ contributions: [{ playerName: 'Real deck', oracleIds: ['card-a'], wins: 1, losses: 1, draws: 0 }] }),
    submitter: async () => { submissions += 1; },
  });
  assert.equal(result.status, 'needs-review');
  assert.equal(submissions, 0);
});
