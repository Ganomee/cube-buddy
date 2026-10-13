import assert from 'node:assert/strict';
import test from 'node:test';
import { createCubeCobraConnectionStore, parseRecordShareToken } from '../src/cube-cobra-connection.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('accepts a Cube Cobra record share link or a copied token', () => {
  assert.equal(parseRecordShareToken('https://cubecobra.com/cube/record/contribute?token=abc.def_123-XYZ'), 'abc.def_123-XYZ');
  assert.equal(parseRecordShareToken('abc.def_123-XYZ'), 'abc.def_123-XYZ');
  assert.throws(() => parseRecordShareToken('https://example.com/?token=secret'), /Cube Cobra/);
  assert.throws(() => parseRecordShareToken('token with spaces'), /valid record share/);
});

test('stores a record share token per cube outside the project backup', () => {
  const storage = memoryStorage();
  const connections = createCubeCobraConnectionStore(storage);

  connections.save('cube-1', 'https://cubecobra.com/cube/record/contribute?token=first.token');
  connections.save('cube-2', 'second_token');

  assert.deepEqual(connections.get('cube-1'), { cubeId: 'cube-1', token: 'first.token' });
  assert.deepEqual(connections.get('cube-2'), { cubeId: 'cube-2', token: 'second_token' });
  connections.remove('cube-1');
  assert.equal(connections.get('cube-1'), null);
});
