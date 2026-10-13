import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchCubeCobraCsv, parseCubeCobraId } from '../src/cube-cobra-client.js';

test('accepts a Cube Cobra URL, UUID, or short ID', () => {
  assert.equal(parseCubeCobraId('https://cubecobra.com/cube/list/my-cube?view=spoiler'), 'my-cube');
  assert.equal(parseCubeCobraId('my-cube'), 'my-cube');
  assert.throws(() => parseCubeCobraId('https://example.com/cube/list/nope'), /Cube Cobra/i);
});

test('fetches public cube JSON and imports the mainboard by default', async () => {
  const requests = [];
  const fetcher = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () => ({
        name: 'Test Cube',
        shortId: 'test-cube',
        cards: {
          mainboard: [{ name: 'Fire // Ice', set: 'MH2', collector_number: '290', image_normal: 'https://img/front.jpg', image_back: 'https://img/back.jpg' }],
          maybeboard: [{ name: 'Sol Ring', set: 'C21', collector_number: '263', image_normal: 'https://img/sol.jpg' }],
        },
      }),
    };
  };

  const result = await fetchCubeCobraCsv('https://cubecobra.com/cube/overview/test-cube', { fetcher });
  assert.deepEqual(requests, ['https://cubecobra.com/cube/api/cubeJSON/test-cube']);
  assert.equal(result.cubeId, 'test-cube');
  assert.equal(result.name, 'Test Cube');
  assert.match(result.csv, /Fire \/\/ Ice,MH2,290,mainboard,https:\/\/img\/front\.jpg,https:\/\/img\/back\.jpg/);
  assert.doesNotMatch(result.csv, /Sol Ring/);
  assert.deepEqual(result.availableBoards, { mainboard: 1, maybeboard: 1 });
});

test('can explicitly select additional Cube Cobra boards', async () => {
  const fetcher = async () => ({
    ok: true,
    json: async () => ({ name: 'Test Cube', cards: {
      mainboard: [{ name: 'Sol Ring', details: { name: 'Sol Ring', set: 'C21', collector_number: '263' } }],
      maybeboard: [{ name: 'Black Lotus', details: { name: 'Black Lotus', set: 'VMA', collector_number: '4' } }],
    } }),
  });
  const result = await fetchCubeCobraCsv('test-cube', { fetcher, boards: ['mainboard', 'maybeboard'] });
  assert.match(result.csv, /Sol Ring/);
  assert.match(result.csv, /Black Lotus/);
});

test('reads the live Cube Cobra shape from nested details and prefers cube artwork overrides', async () => {
  const fetcher = async () => ({
    ok: true,
    json: async () => ({
      name: 'Powered One Drop Cube',
      id: '0b0d5ab4-9816-4d1a-b726-bfd211317413',
      cards: {
        mainboard: [{
          cardID: 'printing-id',
          imgUrl: 'https://custom.example/front.png',
          imgBackUrl: 'https://custom.example/back.png',
          details: { name: 'Arcbound Javelineer', set: 'mh2', collector_number: '2', oracle_id: 'oracle-id', image_normal: 'https://default.example/front.webp' },
        }],
      },
    }),
  });
  const result = await fetchCubeCobraCsv('0b0d5ab4-9816-4d1a-b726-bfd211317413', { fetcher });
  assert.equal(result.cubeId, '0b0d5ab4-9816-4d1a-b726-bfd211317413');
  assert.match(result.csv, /Arcbound Javelineer,mh2,2,mainboard,https:\/\/custom\.example\/front\.png,https:\/\/custom\.example\/back\.png/);
  assert.match(result.csv, /printing-id,oracle-id/);
});

test('reports a missing, private, or unavailable cube without exposing credentials', async () => {
  await assert.rejects(
    () => fetchCubeCobraCsv('missing', { fetcher: async () => ({ ok: false, status: 404 }) }),
    /404/,
  );
});
