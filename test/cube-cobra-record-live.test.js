import assert from 'node:assert/strict';
import test from 'node:test';
import { readCubeCobraRecord, submitCubeCobraRecordContribution, verifyCubeCobraRecordShare } from '../src/cube-cobra-record-live.js';
import { planResidualContributions } from '../src/cube-cobra-record-sync.js';

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
