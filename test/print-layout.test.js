import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultPrintLayout, updatePrintOverlay } from '../src/print-layout.js';

test('default editor layout exposes every field as an independent overlay', () => {
  const layout = createDefaultPrintLayout();
  assert.deepEqual(Object.keys(layout.overlays), [
    'games-grid', 'wins-grid', 'pick-history-grid', 'draft-average', 'draft-count',
    'win-percentage', 'game-count', 'qr', 'copy-number', 'name',
  ]);
  assert.deepEqual(layout.overlays['games-grid'].grid, { rows: 5, columns: 10, cellSizeMm: 3.72 });
  assert.deepEqual(layout.overlays['wins-grid'].grid, { rows: 5, columns: 10, cellSizeMm: 3.72 });
  assert.deepEqual(layout.overlays['pick-history-grid'].grid, { rows: 2, columns: 10, cellSizeMm: 4.36 });
  assert.equal(layout.overlays['win-percentage'].enabled, true);
  assert.equal(layout.overlays['game-count'].enabled, true);
});

test('grid size follows rows, columns, and square side length', () => {
  const layout = createDefaultPrintLayout();
  const updated = updatePrintOverlay(layout, 'games-grid', {
    grid: { rows: 3, columns: 4, cellSizeMm: 5 },
  });
  assert.equal(updated.overlays['games-grid'].widthMm, 20);
  assert.equal(updated.overlays['games-grid'].heightMm, 15);
  assert.deepEqual(updated.overlays['wins-grid'], layout.overlays['wins-grid']);
});

test('individual fields can be moved, resized, and disabled', () => {
  const layout = createDefaultPrintLayout();
  const moved = updatePrintOverlay(layout, 'draft-average', {
    xMm: 4, yMm: 5, widthMm: 12, heightMm: 4, enabled: false,
  });
  assert.deepEqual(moved.overlays['draft-average'], {
    ...layout.overlays['draft-average'], xMm: 4, yMm: 5, widthMm: 12, heightMm: 4, enabled: false,
  });
  assert.notEqual(moved.overlays['draft-average'], layout.overlays['draft-average']);
});
