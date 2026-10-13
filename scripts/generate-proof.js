import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { renderA4Proof } from '../src/print-proof.js';

const copies = Array.from({ length: 9 }, (_, index) => ({
  copyId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: `Proof card ${index + 1}`,
}));

const proof = await renderA4Proof(copies);
await mkdir('proof', { recursive: true });
await writeFile('proof/front-a4.svg', proof.frontSvg);
await writeFile('proof/back-a4.svg', proof.backSvg);
await writeFile('proof/manifest.json', `${JSON.stringify(proof.manifest, null, 2)}\n`);
for (const [side, svg] of [['front', proof.frontSvg], ['back', proof.backSvg]]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  await writeFile(`proof/${side}-preview.png`, png);
}
