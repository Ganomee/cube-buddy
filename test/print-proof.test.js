import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTrackingBack, renderA4Proof } from '../src/print-proof.js';

const copies = Array.from({ length: 9 }, (_, index) => ({
  copyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Proof card ${index + 1}`,
}));

test('tracking back has two 50-square count fields, more pick spaces, and identity QR', async () => {
  const svg = await renderTrackingBack(copies[0]);

  assert.match(svg, /width="63\.5mm"/);
  assert.match(svg, /height="88\.9mm"/);
  assert.equal((svg.match(/data-mark="games"/g) ?? []).length, 50);
  assert.equal((svg.match(/data-mark="wins"/g) ?? []).length, 50);
  assert.equal((svg.match(/data-pick-box="\d+"/g) ?? []).length, 30);
  assert.match(svg, /Games/);
  assert.match(svg, /Wins/);
  assert.match(svg, /Average pick/);
  assert.match(svg, /Drafts/);
  assert.match(svg, /cube-buddy:copy:00000000-0000-4000-8000-000000000001/);
  assert.doesNotMatch(svg, /data-outcome=/);
});

test('A4 proof keeps each front and back paired across mirrored positions', async () => {
  const proof = await renderA4Proof(copies);

  assert.match(proof.frontSvg, /width="210mm" height="297mm"/);
  assert.match(proof.backSvg, /width="210mm" height="297mm"/);
  assert.equal(proof.manifest.length, 9);
  assert.deepEqual(proof.manifest[0], {
    number: 1,
    copyId: copies[0].copyId,
    frontSlot: 0,
    backSlot: 2,
  });
  assert.equal(proof.manifest[4].backSlot, 4);
  assert.equal(proof.manifest[8].backSlot, 6);
});

test('proof rejects anything except nine distinct physical copies', async () => {
  await assert.rejects(() => renderA4Proof(copies.slice(0, 8)), /nine/i);
  await assert.rejects(() => renderA4Proof([...copies.slice(0, 8), copies[0]]), /distinct/i);
});
