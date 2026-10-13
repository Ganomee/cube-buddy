import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTrackingBack, renderA4Proof } from '../src/print-proof.js';

const copies = Array.from({ length: 9 }, (_, index) => ({
  copyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Proof card ${index + 1}`,
}));

test('tracking back has actual card size, 50 numbered W/L slots, and identity QR', async () => {
  const svg = await renderTrackingBack(copies[0]);

  assert.match(svg, /width="63\.5mm"/);
  assert.match(svg, /height="88\.9mm"/);
  assert.equal((svg.match(/data-slot="\d+"/g) ?? []).length, 50);
  assert.match(svg, /data-slot="1"/);
  assert.match(svg, /data-slot="50"/);
  assert.match(svg, /Average pick/);
  assert.match(svg, /Drafts/);
  assert.match(svg, /cube-buddy:copy:00000000-0000-4000-8000-000000000001/);
  assert.doesNotMatch(svg, /data-outcome="D"/);
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
