const DOUBLE_FACED_LAYOUTS = new Set(['transform', 'modal_dfc', 'reversible_card']);

export const DEFAULT_PROXXIED_PRINT_SETTINGS = Object.freeze({
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

function printSettings(overrides = {}) {
  const settings = { ...DEFAULT_PROXXIED_PRINT_SETTINGS, ...overrides };
  if (!Number.isInteger(settings.cols) || settings.cols < 1 || !Number.isInteger(settings.rows) || settings.rows < 1) {
    throw new TypeError('Proxxied rows and columns must be positive integers');
  }
  for (const key of ['bleedEdgeWidthMm', 'guideWidthPx', 'pageWidthInches', 'pageHeightInches']) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0) throw new TypeError(`Invalid Proxxied setting: ${key}`);
  }
  return Object.freeze(settings);
}

function isDoubleFaced(entry) {
  return DOUBLE_FACED_LAYOUTS.has(entry.layout) || Boolean(entry.artwork?.backUrl);
}

function mirroredSlots(cards, cols, perPage) {
  const slots = Array(perPage).fill(null);
  cards.forEach((card, index) => {
    const row = Math.floor(index / cols);
    const column = index % cols;
    slots[row * cols + (cols - 1 - column)] = card;
  });
  return slots;
}

function pagePairs(entries, { section, frontKind, backKind, cols, rows }) {
  const perPage = cols * rows;
  const pages = [];
  for (let start = 0; start < entries.length; start += perPage) {
    const cards = entries.slice(start, start + perPage);
    pages.push({ section, kind: frontKind, cards: [...cards, ...Array(perPage - cards.length).fill(null)] });
    pages.push({ section, kind: backKind, cards: mirroredSlots(cards, cols, perPage) });
  }
  return pages;
}

export function createPrintProject(entries, { printSettings: overrides } = {}) {
  if (!Array.isArray(entries)) throw new TypeError('Cube entries are required');
  const settings = printSettings(overrides);
  const doubleFaced = entries.filter(isDoubleFaced);
  const pages = [
    ...pagePairs(entries, {
      section: 'tracked', frontKind: 'tracked-front', backKind: 'tracking-back',
      cols: settings.cols, rows: settings.rows,
    }),
    ...pagePairs(doubleFaced, {
      section: 'playable-dfc', frontKind: 'dfc-front', backKind: 'dfc-back',
      cols: settings.cols, rows: settings.rows,
    }),
  ];
  return {
    engine: Object.freeze({ name: 'Proxxied', exporter: 'exportProxyPagesToPdf' }),
    printSettings: settings,
    pages,
    summary: Object.freeze({ trackedCards: entries.length, playableDoubleFacedCards: doubleFaced.length }),
  };
}

export function toProxxiedCard(entry, { face = 'front' } = {}) {
  if (!entry?.copyId || !entry?.name) throw new TypeError('A physical cube entry is required');
  if (!['front', 'back'].includes(face)) throw new TypeError('Face must be front or back');
  const imageUrl = face === 'front' ? entry.artwork?.frontUrl : entry.artwork?.backUrl;
  if (!imageUrl) throw new Error(`${entry.name} has no ${face} artwork for Proxxied`);
  return {
    uuid: `${entry.copyId}:${face}`,
    name: entry.name,
    imageUrls: [imageUrl],
    isUserUpload: false,
    set: entry.printing?.set,
    number: entry.printing?.collectorNumber,
  };
}
