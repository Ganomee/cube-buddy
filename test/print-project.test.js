import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPrintProject,
  DEFAULT_PROXXIED_PRINT_SETTINGS,
  toProxxiedCard,
} from '../src/print-project.js';

function entry(index, { doubleFaced = false } = {}) {
  return {
    copyId: `copy-${index}`,
    name: `Card ${index}`,
    layout: doubleFaced ? 'transform' : 'normal',
    printing: { set: 'TST', collectorNumber: String(index) },
    artwork: {
      frontUrl: `https://assets.cubecobra.com/${index}.webp`,
      backUrl: doubleFaced ? `https://assets.cubecobra.com/${index}-back.webp` : '',
    },
  };
}

test('print settings use Proxxied exporter fields and accept a saved printer profile', () => {
  assert.deepEqual(DEFAULT_PROXXIED_PRINT_SETTINGS, {
    bleedEdge: false,
    bleedEdgeWidthMm: 0,
    guideColor: '#000000',
    guideWidthPx: 0.5,
    pageWidthInches: 210 / 25.4,
    pageHeightInches: 297 / 25.4,
    pdfPageColor: '#FFFFFF',
    cols: 3,
    rows: 3,
  });

  const project = createPrintProject([entry(1)], {
    printSettings: { bleedEdge: true, bleedEdgeWidthMm: 1 },
  });
  assert.equal(project.printSettings.bleedEdge, true);
  assert.equal(project.printSettings.bleedEdgeWidthMm, 1);
  assert.equal(project.printSettings.cols, 3);
});

test('tracked card pairs come first and playable double-faced pairs occupy ending pages', () => {
  const entries = [
    ...Array.from({ length: 11 }, (_, index) => entry(index + 1)),
    ...Array.from({ length: 10 }, (_, index) => entry(index + 12, { doubleFaced: true })),
  ];
  const project = createPrintProject(entries);

  assert.equal(project.pages.length, 8);
  assert.deepEqual(project.pages.map((page) => page.kind), [
    'tracked-front', 'tracking-back', 'tracked-front', 'tracking-back',
    'dfc-front', 'dfc-back', 'dfc-front', 'dfc-back',
  ]);
  assert.equal(project.pages[4].cards[0].copyId, 'copy-12');
  assert.equal(project.pages[5].cards[2].copyId, 'copy-12');
  assert.ok(project.pages.slice(0, 4).every((page) => page.section === 'tracked'));
  assert.ok(project.pages.slice(4).every((page) => page.section === 'playable-dfc'));
});

test('Proxxied card adapter preserves Cube Cobra WebP artwork', () => {
  const card = toProxxiedCard(entry(7), { face: 'front' });
  assert.deepEqual(card, {
    uuid: 'copy-7:front',
    name: 'Card 7',
    imageUrls: ['https://assets.cubecobra.com/7.webp'],
    isUserUpload: false,
    set: 'TST',
    number: '7',
  });
  assert.throws(() => toProxxiedCard(entry(7), { face: 'back' }), /back artwork/i);
});
