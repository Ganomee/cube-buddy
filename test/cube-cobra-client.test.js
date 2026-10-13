import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchCubeCobraCsv, parseCubeCobraId } from '../src/cube-cobra-client.js';

test('accepts a Cube Cobra URL, UUID, or short ID', () => {
  assert.equal(parseCubeCobraId('https://cubecobra.com/cube/list/my-cube?view=spoiler'), 'my-cube');
  assert.equal(parseCubeCobraId('my-cube'), 'my-cube');
  assert.throws(() => parseCubeCobraId('https://example.com/cube/list/nope'), /Cube Cobra/i);
});

test('fetches public cube JSON and converts every board with selected artwork', async () => {
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
  assert.match(result.csv, /Sol Ring,C21,263,maybeboard,https:\/\/img\/sol\.jpg,/);
});

test('reports a missing, private, or unavailable cube without exposing credentials', async () => {
  await assert.rejects(
    () => fetchCubeCobraCsv('missing', { fetcher: async () => ({ ok: false, status: 404 }) }),
    /404/,
  );
});
