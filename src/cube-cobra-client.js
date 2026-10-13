const CUBE_PATHS = new Set(['overview', 'list', 'playtest', 'analysis', 'blog', 'history']);

export function parseCubeCobraId(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('A Cube Cobra URL or cube ID is required');
  const input = value.trim();
  if (!input.includes('://')) return input.replace(/^\/+|\/+$/g, '');
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid Cube Cobra URL');
  }
  if (!['cubecobra.com', 'www.cubecobra.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('Use a Cube Cobra URL or cube ID');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'cube' || !CUBE_PATHS.has(parts[1]) || !parts[2]) throw new Error('Cube Cobra cube URL is missing its ID');
  return decodeURIComponent(parts[2]);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function cardValue(card, ...keys) {
  for (const key of keys) if (card?.[key] !== undefined && card[key] !== null) return card[key];
  return '';
}

export async function fetchCubeCobraCsv(value, { fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required');
  const requestedId = parseCubeCobraId(value);
  const endpoint = `https://cubecobra.com/cube/api/cubeJSON/${encodeURIComponent(requestedId)}`;
  const response = await fetcher(endpoint, { headers: { Accept: 'application/json' } });
  if (!response?.ok) throw new Error(`Cube Cobra request failed (${response?.status ?? 'network error'})`);
  const cube = await response.json();
  if (!cube || typeof cube !== 'object' || !cube.cards || typeof cube.cards !== 'object') throw new Error('Cube Cobra returned an invalid cube');

  const rows = [['name', 'Set', 'Collector Number', 'board', 'image URL', 'image Back URL']];
  for (const [board, cards] of Object.entries(cube.cards)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const details = card?.details && typeof card.details === 'object' ? card.details : {};
      rows.push([
        cardValue(card, 'name') || cardValue(details, 'name'),
        cardValue(card, 'set', 'set_code') || cardValue(details, 'set', 'set_code'),
        cardValue(card, 'collector_number', 'collectorNumber') || cardValue(details, 'collector_number', 'collectorNumber'),
        board,
        cardValue(card, 'imgUrl', 'image_normal', 'image_url', 'imageUrl') || cardValue(details, 'image_normal', 'image_url', 'imageUrl'),
        cardValue(card, 'imgBackUrl', 'image_back', 'image_back_url', 'imageBackUrl') || cardValue(details, 'image_back', 'image_back_url', 'imageBackUrl'),
      ]);
    }
  }
  return {
    cubeId: String(cube.shortId || cube.id || requestedId),
    name: String(cube.name || requestedId),
    csv: rows.map((row) => row.map(csvCell).join(',')).join('\n'),
  };
}
