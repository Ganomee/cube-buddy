import assert from 'node:assert/strict';
import test from 'node:test';
import { readCubeCobraRecord, submitCubeCobraRecordContribution, verifyCubeCobraRecordShare } from '../src/cube-cobra-record-live.js';
import { planResidualContributions, syncCubeCobraResiduals } from '../src/cube-cobra-record-sync.js';

test('live Cube Cobra contribution link opens the expected record', { timeout: 15_000 }, async (context) => {
  const shareUrl = process.env.CUBE_COBRA_RECORD_SHARE_URL;
  if (!shareUrl) return context.skip('CUBE_COBRA_RECORD_SHARE_URL is not configured');

  const result = await verifyCubeCobraRecordShare(shareUrl);

  assert.equal(result.recordId, '4ffef4cc-4c8c-460b-b175-aa64f96474a2');
  assert.equal(result.valid, true);
});

test('live Cube Cobra record accepts and returns a one-card result', { timeout: 30_000 }, async (context) => {
  const shareUrl = process.env.CUBE_COBRA_RECORD_SHARE_URL;
  if (!shareUrl || process.env.CUBE_COBRA_ENABLE_WRITE_TEST !== '1') {
    return context.skip('Set the record URL and CUBE_COBRA_ENABLE_WRITE_TEST=1 to run the write test');
  }

  const result = await submitCubeCobraRecordContribution(shareUrl, {
    playerName: 'Cube Buddy automated test',
    oracleIds: ['48e3f6dd-68ab-420a-ad4d-fe7ee39486d3'],
    wins: 1,
    losses: 0,
    draws: 0,
  });

  assert.equal(result.recordId, '4ffef4cc-4c8c-460b-b175-aa64f96474a2');
  assert.equal(result.playerName, 'Cube Buddy automated test');
  assert.deepEqual(result.record, { wins: 1, losses: 0, draws: 0 });
  assert.deepEqual(result.oracleIds, ['48e3f6dd-68ab-420a-ad4d-fe7ee39486d3']);
});

test('live Cube Cobra record accepts the residual produced by the sync algorithm', { timeout: 30_000 }, async (context) => {
  const shareUrl = process.env.CUBE_COBRA_RECORD_SHARE_URL;
  if (!shareUrl || process.env.CUBE_COBRA_ENABLE_WRITE_TEST !== '1') {
    return context.skip('Set the record URL and CUBE_COBRA_ENABLE_WRITE_TEST=1 to run the write test');
  }
  const oracleId = '48e3f6dd-68ab-420a-ad4d-fe7ee39486d3';
  const before = await readCubeCobraRecord(shareUrl);
  const [planned] = planResidualContributions([{ oracleId, games: 1, wins: 1 }], before.contributions);
  assert.equal(planned.wins, 0);
  assert.equal(planned.losses, 0);

  const saved = await submitCubeCobraRecordContribution(shareUrl, planned);

  assert.equal(saved.playerName, `Cube Buddy · ${oracleId}`);
  assert.deepEqual(saved.record, { wins: 0, losses: 0, draws: 0 });
  assert.deepEqual(saved.oracleIds, [oracleId]);
});

test('live sync aggregates overlapping decks with 10 and 8 matches', { timeout: 60_000 }, async (context) => {
  const shareUrl = process.env.CUBE_COBRA_RECORD_SHARE_URL;
  if (!shareUrl || process.env.CUBE_COBRA_ENABLE_WRITE_TEST !== '1') {
    return context.skip('Set the record URL and CUBE_COBRA_ENABLE_WRITE_TEST=1 to run the write test');
  }
  const cardA = '5e59199c-facc-46b4-9681-988de0cfaba2';
  const cardB = '9c4a3ca6-dcf9-4986-81da-bcfd46414bee';
  const cardC = 'faeaa3eb-6eb8-4621-98c7-0c6f58bbff85';
  await submitCubeCobraRecordContribution(shareUrl, {
    playerName: 'Cube Buddy fixture · 10 matches', oracleIds: [cardA, cardB], wins: 6, losses: 4, draws: 0,
  });
  await submitCubeCobraRecordContribution(shareUrl, {
    playerName: 'Cube Buddy fixture · 8 matches', oracleIds: [cardB, cardC], wins: 5, losses: 3, draws: 0,
  });

  const result = await syncCubeCobraResiduals(shareUrl, [
    { oracleId: cardA, games: 13, wins: 8 },
    { oracleId: cardB, games: 22, wins: 13 },
    { oracleId: cardC, games: 9, wins: 5 },
  ]);

  assert.equal(result.status, 'applied');
  assert.deepEqual(result.plan.map(({ oracleIds, wins, losses }) => ({ oracleIds, wins, losses })), [
    { oracleIds: [cardA], wins: 2, losses: 1 },
    { oracleIds: [cardB], wins: 2, losses: 2 },
    { oracleIds: [cardC], wins: 0, losses: 1 },
  ]);
  const saved = await readCubeCobraRecord(shareUrl);
  for (const planned of result.plan) {
    const actual = saved.contributions.find((entry) => entry.playerName === planned.playerName);
    assert.deepEqual(actual, planned);
  }
});
