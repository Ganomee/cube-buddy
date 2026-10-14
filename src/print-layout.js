const overlay = (label, color, xMm, yMm, widthMm, heightMm, extra = {}) => ({
  label, color, enabled: true, xMm, yMm, widthMm, heightMm, ...extra,
});

export function createDefaultPrintLayout() {
  return {
    widthMm: 63.5,
    heightMm: 88.9,
    backgroundImage: 'cardback nice.png',
    overlays: {
      'games-grid': overlay('Games grid', '#e8f08b', 14.65, 15.8, 37.2, 18.6, { grid: { rows: 5, columns: 10, cellSizeMm: 3.72 } }),
      'wins-grid': overlay('Wins grid', '#78d9c4', 14.65, 54.35, 37.2, 18.6, { grid: { rows: 5, columns: 10, cellSizeMm: 3.72 } }),
      'pick-history-grid': overlay('Pick history', '#f3a65a', 12.7, 7.52, 43.6, 8.72, { grid: { rows: 2, columns: 10, cellSizeMm: 4.36 } }),
      'draft-average': overlay('Draft average', '#d18ce0', 3.2, 7.52, 8.5, 3.25),
      'draft-count': overlay('Draft count', '#9f8ce0', 3.2, 11.58, 8.5, 3.25),
      'win-percentage': overlay('Win percentage', '#54b8e8', 9.3, 73.7, 12, 2),
      'game-count': overlay('Game count', '#4b91cf', 42, 73.7, 12, 2),
      qr: overlay('QR code', '#ffffff', 23.85, 36.1, 15.8, 15.8),
      'copy-number': overlay('Copy number', '#ff7f8f', 22.75, 73.25, 18, 2.4),
      name: overlay('Card name', '#f5d76e', 9.3, 76.1, 44.6, 6.4),
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

export function serializePrintTemplate(layout) {
  return JSON.stringify({ format: 'cube-buddy-print-template', version: 1, layout }, null, 2);
}

export function parsePrintTemplate(json) {
  let value;
  try { value = JSON.parse(json); } catch { throw new Error('Invalid print template JSON'); }
  const layout = value?.format === 'cube-buddy-print-template' ? value.layout : value;
  if (!layout || !Number.isFinite(layout.widthMm) || !Number.isFinite(layout.heightMm) || !layout.overlays || typeof layout.overlays !== 'object') {
    throw new Error('Print template must contain card dimensions and overlays');
  }
  for (const [id, item] of Object.entries(layout.overlays)) {
    if (!/^#[0-9a-f]{6}$/i.test(item.color ?? '') || typeof item.enabled !== 'boolean') throw new Error(`Invalid overlay: ${id}`);
    for (const key of ['xMm', 'yMm', 'widthMm', 'heightMm']) finite(item[key], `${id}.${key}`);
  }
  return layout;
}
