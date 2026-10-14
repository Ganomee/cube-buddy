const overlay = (label, xMm, yMm, widthMm, heightMm, extra = {}) => ({
  label, enabled: true, xMm, yMm, widthMm, heightMm, ...extra,
});

export function createDefaultPrintLayout() {
  return {
    widthMm: 63.5,
    heightMm: 88.9,
    backgroundImage: 'cardback nice.png',
    overlays: {
      'games-grid': overlay('Games grid', 14.65, 15.8, 37.2, 18.6, { grid: { rows: 5, columns: 10, cellSizeMm: 3.72 } }),
      'wins-grid': overlay('Wins grid', 14.65, 54.35, 37.2, 18.6, { grid: { rows: 5, columns: 10, cellSizeMm: 3.72 } }),
      'pick-history-grid': overlay('Pick history', 12.7, 7.52, 43.6, 8.72, { grid: { rows: 2, columns: 10, cellSizeMm: 4.36 } }),
      'draft-average': overlay('Draft average', 3.2, 7.52, 8.5, 3.25),
      'draft-count': overlay('Draft count', 3.2, 11.58, 8.5, 3.25),
      'win-percentage': overlay('Win percentage', 9.3, 73.7, 12, 2),
      'game-count': overlay('Game count', 42, 73.7, 12, 2),
      qr: overlay('QR code', 23.85, 36.1, 15.8, 15.8),
      'copy-number': overlay('Copy number', 23.9, 73.65, 15.7, 1.6),
      name: overlay('Card name', 9.3, 76.1, 44.6, 6.4),
    },
  };
}

function finite(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`);
  return value;
}

export function updatePrintOverlay(layout, id, changes) {
  const current = layout?.overlays?.[id];
  if (!current) throw new Error(`Unknown print overlay: ${id}`);
  const next = { ...current, ...changes };
  if (changes.grid) {
    const grid = { ...current.grid, ...changes.grid };
    if (!Number.isInteger(grid.rows) || grid.rows < 1 || !Number.isInteger(grid.columns) || grid.columns < 1) {
      throw new TypeError('Grid rows and columns must be positive integers');
    }
    finite(grid.cellSizeMm, 'Grid cell size');
    next.grid = grid;
    next.widthMm = grid.columns * grid.cellSizeMm;
    next.heightMm = grid.rows * grid.cellSizeMm;
  }
  for (const key of ['xMm', 'yMm', 'widthMm', 'heightMm']) finite(next[key], key);
  return { ...layout, overlays: { ...layout.overlays, [id]: next } };
}
