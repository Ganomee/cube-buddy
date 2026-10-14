import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { renderA4Proof, renderCardbackPositionTemplate, renderTrackingBack } from '../src/print-proof.js';

const copies = Array.from({ length: 9 }, (_, index) => ({
  copyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Proof card ${index + 1}`,
}));

const proof = await renderA4Proof(copies);
const positionTemplate = await renderCardbackPositionTemplate();
const sampleCardback = await renderTrackingBack(copies[0]);
await mkdir('proof', { recursive: true });
await writeFile('proof/front-a4.svg', proof.frontSvg);
await writeFile('proof/back-a4.svg', proof.backSvg);
await writeFile('proof/overlay-template.svg', positionTemplate);
await writeFile('proof/cardback-sample.svg', sampleCardback);
await writeFile('proof/manifest.json', `${JSON.stringify(proof.manifest, null, 2)}\n`);
for (const [name, svg, width] of [
  ['front-preview', proof.frontSvg, 1200],
  ['back-preview', proof.backSvg, 1200],
  ['overlay-template', positionTemplate, 600],
  ['cardback-sample', sampleCardback, 600],
]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  await writeFile(`proof/${name}.png`, png);
}
