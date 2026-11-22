import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  confirmDraftRoster,
  parseDraftmancerLog,
  parseDraftRosterHandoff,
} from '../src/draft-roster.js';

const log20 = readFileSync(new URL('./fixtures/draftmancer-v2.0.json', import.meta.url), 'utf8');
const log21 = readFileSync(new URL('./fixtures/draftmancer-v2.1.txt', import.meta.url), 'utf8');
const alex = 'c0f420ee-edbc-4a58-a1a5-111111111111';
const secondAlex = 'eb796ba1-af24-4b3d-8c5f-222222222222';
const morgan = '4e2193e2-9b3a-465f-8a9d-333333333333';
const quinn = '70ab5dab-8914-4ce8-89eb-444444444444';
const bolt = 'b513532b-8214-428d-b536-f90b44a88ac5';

test('v2.1 carries a selected deck and retains distinct seats with the same name', () => {
  const log = parseDraftmancerLog(log21);
  assert.equal(log.skippedBots, 1);
  assert.deepEqual(log.seats.map(({ name, deckStatus, poolSize }) => [name, deckStatus, poolSize]), [
    ['Alex', 'available', 5],
    ['Alex', 'omitted', 1],
    ['Morgan', 'omitted', 0],
    ['Quinn', 'available', 1],
  ]);
  const choices = new Map([
    [alex, { includeDeck: true }],
    [morgan, { present: false }],
  ]);
  const roster = confirmDraftRoster(log, choices);
  assert.deepEqual(roster.source, {
    provider: 'draftmancer', sessionId: 'Friday Cube 42', draftTime: 1795212000000, logVersion: '2.1',
  });
  assert.deepEqual(roster.players.map(({ playerId, name }) => [playerId, name]), [
    [alex, 'Alex'], [secondAlex, 'Alex'], [quinn, 'Quinn'],
  ]);
  assert.deepEqual(roster.players[0].deck.mainboard.map(({ name, quantity }) => [name, quantity]), [
    ['Lightning Bolt', 2], ['Island', 1],
  ]);
  assert.deepEqual(roster.players[0].deck.sideboard.map(({ name, quantity }) => [name, quantity]), [
    ['Lightning Bolt', 1], ['Festival Familiar', 1],
  ]);
  assert.deepEqual(roster.players[0].deck.mainboard[0], {
    cardId: bolt, name: 'Lightning Bolt', quantity: 2,
    oracleId: '9141e3cb-a635-48ea-b42f-5d4ab16e42a9', set: 'm11', collectorNumber: '149',
  });
  assert.deepEqual(roster.players[0].deck.basicLands, { W: 0, U: 7, B: 0, R: 8, G: 0 });
  assert.equal(roster.players[1].deck, undefined);
  assert.equal(roster.players[2].deck, undefined);
  assert.deepEqual(parseDraftRosterHandoff(JSON.stringify(roster)), roster);
  assert.deepEqual(confirmDraftRoster(parseDraftmancerLog(log21), choices), roster);
});

test('v2.0 supports legacy picks and preserves explicit basic lands', () => {
  const log = parseDraftmancerLog(log20);
  const [seat] = log.seats;
  const roster = confirmDraftRoster(log, new Map([[seat.playerId, { includeDeck: true }]]));
  assert.equal(roster.source.logVersion, '2.0');
  assert.equal(roster.players[0].playerId, '20f954f4-ffb6-4267-98ef-555555555555');
  assert.equal(roster.players[0].deck.mainboard[0].name, 'Llanowar Elves');
  assert.deepEqual(roster.players[0].deck.basicLands, { W: 0, U: 0, B: 0, R: 0, G: 17 });
});

test('redacted and unresolved decks cannot be carried over, and the affected seats can play', () => {
  const log = JSON.parse(log21);
  log.users[alex].decklist.side.push('missing-printing');
  log.users[quinn].decklist = { main: [], side: [], hashes: { mtgo: 'synthetic-hash' } };
  const review = parseDraftmancerLog(JSON.stringify(log));
  assert.equal(review.seats[0].deckStatus, 'invalid');
  assert.match(review.seats[0].deckError, /sideboard.*missing-printing/i);
  assert.equal(review.seats[3].deckStatus, 'withheld');
  assert.throws(() => confirmDraftRoster(review, new Map([[alex, { includeDeck: true }]])), /Alex.*deck/i);
  assert.equal(confirmDraftRoster(review).players.length, 4);
  assert.ok(confirmDraftRoster(review).players.every((player) => !Object.hasOwn(player, 'deck')));
});

test('broken draft or seat identity fails instead of producing a partial roster', () => {
  const log = JSON.parse(log21);
  assert.throws(() => parseDraftmancerLog('bad JSON'), /valid JSON/i);
  assert.throws(() => parseDraftmancerLog(JSON.stringify({ ...log, version: '3.0' })), /version.*2\.0.*2\.1/i);
  assert.throws(() => parseDraftmancerLog(JSON.stringify({ ...log, delayed: true })), /locked/i);
  log.users.alias = log.users[alex];
  assert.throws(() => parseDraftmancerLog(JSON.stringify(log)), /player ID/i);
  delete log.users.alias;
  Object.defineProperty(log.users, '__proto__', { enumerable: true, value: { ...log.users[alex], userID: '__proto__' } });
  assert.throws(() => parseDraftmancerLog(JSON.stringify(log)), /unsafe.*player ID/i);
});

test('handoff rejects duplicate seats and invalid carried quantities', () => {
  const review = parseDraftmancerLog(log21);
  const roster = confirmDraftRoster(review, new Map([[alex, { includeDeck: true }]]));
  assert.throws(() => parseDraftRosterHandoff(JSON.stringify({ ...roster, schemaVersion: 2 })), /version/i);
  assert.throws(() => parseDraftRosterHandoff(JSON.stringify({
    ...roster, players: [roster.players[0], roster.players[0]],
  })), /duplicate.*player ID/i);
  roster.players[0].deck.mainboard[0].quantity = -1;
  assert.throws(() => parseDraftRosterHandoff(JSON.stringify(roster)), /quantity/i);
});
