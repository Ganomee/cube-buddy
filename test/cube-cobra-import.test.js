import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importCubeCobraCsv } from '../src/cube-cobra-import.js';

const header = 'name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,board,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID,Custom,Voucher,Artist';

test('imports duplicate Cube Cobra rows as distinct copies with selected artwork', () => {
  const csv = [
    header,
    '"Delver of Secrets",1,Creature,U,ISD,51,common,Blue,Owned,Non-foil,mainboard,false,https://art.example/front.jpg,https://art.example/back.jpg,,,123,false,,Artist',
    '"Delver of Secrets",1,Creature,U,ISD,51,common,Blue,Owned,Non-foil,mainboard,false,https://art.example/merged.jpg,,,,123,false,,Artist',
  ].join('\r\n');
  const result = importCubeCobraCsv(csv, { cubeId: 'owner-cube', versionId: 'v1' });

  assert.equal(result.cube.cubeId, 'owner-cube');
  assert.equal(result.cube.versionId, 'v1');
  assert.equal(result.cube.entries.length, 2);
  assert.notEqual(result.cube.entries[0].copyId, result.cube.entries[1].copyId);
  assert.equal(result.cube.entries[0].sourceRow, 2);
  assert.equal(result.cube.entries[0].printing.set, 'ISD');
  assert.equal(result.cube.entries[0].printing.collectorNumber, '51');
  assert.equal(result.cube.entries[0].artwork.frontUrl, 'https://art.example/front.jpg');
  assert.equal(result.cube.entries[0].artwork.backUrl, 'https://art.example/back.jpg');
  assert.equal(result.cube.entries[1].artwork.frontUrl, 'https://art.example/merged.jpg');
  assert.deepEqual(result.review, []);
});

test('parses quoted commas and escaped quotes without changing names', () => {
  const csv = `${header}\n"A Card, Called ""Example""",1,Creature,U,TST,7,,,,mainboard,false,,,,,,,,`;
  const result = importCubeCobraCsv(csv, { cubeId: 'cube-1', versionId: 'v1' });

  assert.equal(result.cube.entries[0].name, 'A Card, Called "Example"');
});

test('retains missing-name rows for review instead of dropping them', () => {
  const csv = `${header}\n,1,Creature,U,TST,7,,,,mainboard,false,,,,,,,,`;
  const result = importCubeCobraCsv(csv, { cubeId: 'cube-1', versionId: 'v1' });

  assert.equal(result.cube.entries.length, 1);
  assert.equal(result.review[0].sourceRow, 2);
  assert.match(result.review[0].reason, /name/i);
});

test('rejects malformed CSV rather than silently shifting artwork and printing columns', () => {
  const csv = `${header}\n"Unclosed,1,Creature,U,TST,7,,,,mainboard,false,,,,,,,,`;
  assert.throws(() => importCubeCobraCsv(csv, { cubeId: 'cube-1', versionId: 'v1' }), /unclosed quote/i);
});
