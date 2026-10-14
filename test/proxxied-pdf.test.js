import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { normalizeArtworkForProxxied, renderProxxiedPdf } from '../src/proxxied-pdf.js';

test('normalizes WebP artwork to a PNG that Proxxied and jsPDF can embed', async () => {
  const webp = await sharp({
    create: { width: 8, height: 8, channels: 4, background: '#336699' },
  }).webp().toBuffer();

  const png = await normalizeArtworkForProxxied(webp, 'image/webp');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(await sharp(png).metadata().then(({ format, width, height }) => ({ format, width, height })), {
    format: 'png', width: 8, height: 8,
  });
});

test('renders the planned tracked and DFC page order through the Proxxied PDF pipeline', async () => {
  const png = await sharp({
    create: { width: 20, height: 28, channels: 4, background: '#ffffff' },
  }).png().toBuffer();
  const requested = [];
  const project = {
    printSettings: {
      bleedEdge: false, bleedEdgeWidthMm: 0, guideColor: '#000000', guideWidthPx: 0.5,
      pageWidthInches: 210 / 25.4, pageHeightInches: 297 / 25.4,
      pdfPageColor: '#FFFFFF', cols: 3, rows: 3,
    },
    pages: [
      { section: 'tracked', kind: 'tracked-front', cards: [{ copyId: 'copy-1' }] },
      { section: 'tracked', kind: 'tracking-back', cards: [{ copyId: 'copy-1' }] },
      { section: 'playable-dfc', kind: 'dfc-front', cards: [{ copyId: 'copy-2' }] },
      { section: 'playable-dfc', kind: 'dfc-back', cards: [{ copyId: 'copy-2' }] },
    ],
  };

  const pdf = await renderProxxiedPdf(project, {
    dpi: 24,
    resolveCardImage: async (card, page) => {
      requested.push(`${page.kind}:${card.copyId}`);
      return png;
    },
  });

  assert.deepEqual(requested, [
    'tracked-front:copy-1', 'tracking-back:copy-1',
    'dfc-front:copy-2', 'dfc-back:copy-2',
  ]);
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
  assert.match(Buffer.from(pdf).toString('latin1'), /\/Count 4\b/);
});
