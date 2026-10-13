const STORAGE_KEY = 'cube-buddy-cube-cobra-record-connections-v1';
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;

export function parseRecordShareToken(value) {
  const input = value?.trim();
  if (!input) throw new TypeError('Paste a Cube Cobra record share link or token');

  let token = input;
  if (/^https?:\/\//i.test(input)) {
    let url;
    try {
      url = new URL(input);
    } catch {
      throw new Error('Paste a valid Cube Cobra record share link');
    }
    if (url.protocol !== 'https:' || !['cubecobra.com', 'www.cubecobra.com'].includes(url.hostname.toLowerCase())) {
      throw new Error('The record share link must come from Cube Cobra');
    }
    token = url.searchParams.get('token') ?? '';
  }

  if (!token || !TOKEN_PATTERN.test(token)) throw new Error('Paste a valid record share link or token');
  return token;
}

export function createCubeCobraConnectionStore(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('A browser storage provider is required');
  }

  function read() {
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  }

  return {
    get(cubeId) {
      const token = read()[cubeId];
      return typeof token === 'string' ? { cubeId, token } : null;
    },
    save(cubeId, value) {
      if (typeof cubeId !== 'string' || !cubeId.trim()) throw new TypeError('Select a cube before saving a record connection');
      const token = parseRecordShareToken(value);
      storage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [cubeId]: token }));
      return { cubeId, token };
    },
    remove(cubeId) {
      const connections = read();
      delete connections[cubeId];
      if (Object.keys(connections).length) storage.setItem(STORAGE_KEY, JSON.stringify(connections));
      else storage.removeItem(STORAGE_KEY);
    },
  };
}
