import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  renderCardbackTemplate,
  renderTrackingOverlay,
  renderTrackingBack,
  renderA4Proof,
} from '../src/print-proof.js';

const copies = Array.from({ length: 9 }, (_, index) => ({
  copyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Proof card ${index + 1}`,
}));

test('cardback template renders only the supplied base artwork', async () => {
  const svg = await renderCardbackTemplate();
  assert.match(svg, /width="63\.5mm"/);
  assert.match(svg, /height="88\.9mm"/);
  assert.match(svg, /data-cardback-template="cardback nice\.png"/);
  assert.match(svg, /href="data:image\/png;base64,/);
  assert.match(svg, /data-source-size="1024x1536"/);
  assert.doesNotMatch(svg, /data-placeholder=/);
  assert.doesNotMatch(svg, /data-pick-box=/);
});

test('tracking overlay positions replacement fields without the template', async () => {
  const svg = await renderTrackingOverlay(copies[0]);

  assert.doesNotMatch(svg, /data-cardback-template=/);
  assert.match(svg, /data-placeholder="qr" x="23\.85" y="36\.1" width="15\.8" height="15\.8"/);
  assert.match(svg, /data-placeholder="name" x="9\.3" y="76\.1" width="44\.6" height="6\.4"/);
  assert.match(svg, />Proof card 1</);
  assert.match(svg, /data-copy-number="000000001" x="31\.75" y="74\.8"/);
  assert.doesNotMatch(svg, />00000001</);
  assert.match(svg, /cube-buddy:copy:00000000-0000-4000-8000-000000000001/);
  assert.equal((svg.match(/data-mark="games"/g) ?? []).length, 50);
  assert.equal((svg.match(/data-mark="wins"/g) ?? []).length, 50);
  assert.equal((svg.match(/data-pick-box="\d+"/g) ?? []).length, 20);
  assert.match(svg, /data-pick-box="20"/);
  assert.match(svg, /data-pick-box="1" x="12\.700"/);
  assert.match(svg, /data-qr-border="top"/);
  assert.match(svg, /data-qr-border="bottom"/);
});

test('tracking back composes the template before the replacement overlay', async () => {
  const svg = await renderTrackingBack(copies[0]);
  assert.ok(svg.indexOf('data-cardback-template=') < svg.indexOf('data-tracking-overlay='));
  assert.match(svg, /cube-buddy:copy:00000000-0000-4000-8000-000000000001/);
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
  assert.match(proof.backSvg, /data-copy-number="000000001" x="31\.75" y="74\.8"/);
  assert.doesNotMatch(proof.backSvg, /data-proof-number=/);
  assert.doesNotMatch(proof.backSvg, /<text x="58" y="84"/);
});

test('long card names are constrained to the illustrated name plaque', async () => {
  const svg = await renderTrackingBack({
    copyId: copies[0].copyId,
    name: 'This Is an Extremely Long Double-Faced Placeholder Card Name That Must Fit',
  });
  assert.match(svg, /textLength="43\.2" lengthAdjust="spacingAndGlyphs"/);
});

test('proof rejects anything except nine distinct physical copies', async () => {
  await assert.rejects(() => renderA4Proof(copies.slice(0, 8)), /nine/i);
  await assert.rejects(() => renderA4Proof([...copies.slice(0, 8), copies[0]]), /distinct/i);
});
