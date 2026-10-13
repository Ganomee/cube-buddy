import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCubeCobraRecordShare } from '../src/cube-cobra-record-live.js';

test('live Cube Cobra contribution link opens the expected record', { timeout: 15_000 }, async (context) => {
  const shareUrl = process.env.CUBE_COBRA_RECORD_SHARE_URL;
  if (!shareUrl) return context.skip('CUBE_COBRA_RECORD_SHARE_URL is not configured');

  const result = await verifyCubeCobraRecordShare(shareUrl);

  assert.equal(result.recordId, '4ffef4cc-4c8c-460b-b175-aa64f96474a2');
  assert.equal(result.valid, true);
});
