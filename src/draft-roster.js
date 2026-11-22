const rosterFormat = 'cube-buddy-draft-roster';
const logVersions = new Set(['2.0', '2.1']);
const landColors = new Set(['W', 'U', 'B', 'R', 'G']);
const unsafeIds = new Set(['__proto__', 'constructor', 'prototype']);
const unsafeText = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

export const DRAFT_ROSTER_FILE_LIMIT = 16 * 1024 * 1024;
export const DRAFT_ROSTER_FILE_SIZE_ERROR = 'Roster files must be 16 MiB or smaller.';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readText(value, label) {
  if (typeof value !== 'string' || !value.trim() || unsafeText.test(value)) {
    throw new Error(`Missing, invalid, or unsafe ${label}.`);
  }
  return value;
}

function readId(value, label) {
  const id = readText(value, label);
  if (unsafeIds.has(id)) throw new Error(`Unsafe ${label}.`);
  return id;
}

function readJson(contents) {
  if (typeof contents !== 'string') throw new Error('Select a file containing valid JSON.');
  if (new TextEncoder().encode(contents).length > DRAFT_ROSTER_FILE_LIMIT) {
    throw new Error(DRAFT_ROSTER_FILE_SIZE_ERROR);
  }
  let document;
  try {
    document = JSON.parse(contents.replace(/^\uFEFF/u, ''));
  } catch {
    throw new Error('The file does not contain valid JSON.');
  }
  if (!isRecord(document)) throw new Error('Select a Draftmancer DraftLog or Cube Buddy roster file.');
  return document;
}

function readSource(sessionId, draftTime, logVersion) {
  if (!logVersions.has(logVersion)) throw new Error('Supported Draftmancer log versions are 2.0 and 2.1.');
  if (!Number.isSafeInteger(draftTime) || draftTime < 0 || draftTime > 8.64e15) {
    throw new Error('Invalid Draftmancer draft time.');
  }
  return { provider: 'draftmancer', sessionId: readText(sessionId, 'Draftmancer session ID'), draftTime, logVersion };
}

function readBasicLands(lands) {
  if (lands === undefined) return undefined;
  if (!isRecord(lands)) throw new Error('Invalid basic-land counts.');
  const entries = Object.entries(lands);
  for (const [color, count] of entries) {
    if (!landColors.has(color) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('Basic-land counts must be nonnegative integers for W, U, B, R, or G.');
    }
  }
  return Object.fromEntries(entries);
}

function optionalCardMetadata({ oracleId, set, collectorNumber }) {
  const metadata = {};
  for (const [field, value] of Object.entries({ oracleId, set, collectorNumber })) {
    if (value !== undefined && value !== '') metadata[field] = readText(value, `card ${field}`);
  }
  return metadata;
}

function resolveDraftCard(carddata, value, field) {
  const cardId = readId(value, `${field} card ID`);
  const card = Object.hasOwn(carddata, cardId) ? carddata[cardId] : null;
  if (!isRecord(card) || card.id !== cardId) {
    throw new Error(`${field} card "${cardId}" is missing or mismatched in card data.`);
  }
  return { cardId, name: readText(card.name, `name for ${field.toLowerCase()} card "${cardId}"`), card };
}

function readDraftBoard(ids, carddata, field) {
  if (!Array.isArray(ids)) throw new Error(`${field} must contain a list of card IDs.`);
  const entries = new Map();
  for (const value of ids) {
    const existing = entries.get(value);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    const { cardId, name, card } = resolveDraftCard(carddata, value, field);
    const metadata = optionalCardMetadata({
      oracleId: card.oracle_id, set: card.set, collectorNumber: card.collector_number,
    });
    entries.set(cardId, { cardId, name, quantity: 1, ...metadata });
  }
  return [...entries.values()];
}

function hasDeckCards(mainboard, sideboard, basicLands) {
  return mainboard.length > 0 || sideboard.length > 0 || Object.values(basicLands ?? {}).some((count) => count > 0);
}

function previewDeck(decklist, carddata) {
  if (decklist === undefined) return { deckStatus: 'omitted' };
  try {
    if (!isRecord(decklist)) throw new Error('Invalid Draftmancer decklist.');
    const { main, side, lands, hashes } = decklist;
    // A stripped DraftLog can carry hashes with empty boards or with no board fields.
    if (isRecord(hashes) && lands === undefined &&
        (main === undefined || (Array.isArray(main) && main.length === 0)) &&
        (side === undefined || (Array.isArray(side) && side.length === 0))) {
      return { deckStatus: 'withheld' };
    }
    const mainboard = readDraftBoard(main, carddata, 'Mainboard');
    const sideboard = readDraftBoard(side, carddata, 'Sideboard');
    const basicLands = readBasicLands(lands);
    if (!hasDeckCards(mainboard, sideboard, basicLands)) return { deckStatus: 'empty' };
    const deck = { mainboard, sideboard };
    if (basicLands !== undefined) deck.basicLands = basicLands;
    return { deckStatus: 'available', deck };
  } catch (error) {
    return { deckStatus: 'invalid', deckError: error.message };
  }
}

function previewPool(cards, carddata) {
  if (!Array.isArray(cards)) return { poolError: 'Draft pool is missing or malformed.' };
  const poolSize = cards.length;
  try {
    for (const value of new Set(cards)) resolveDraftCard(carddata, value, 'Draft pool');
    return { poolSize };
  } catch (error) {
    return { poolSize, poolError: error.message };
  }
}

function readDraftLog(log) {
  if (!Object.hasOwn(log, 'version')) throw new Error('Select a Draftmancer DraftLog or Cube Buddy roster file.');
  const source = readSource(log.sessionID, log.time, log.version);
  if (log.delayed === true) throw new Error('This DraftLog is locked. Download an unlocked log from Draftmancer.');
  if (!isRecord(log.users) || !Object.keys(log.users).length) throw new Error('The DraftLog has no seat data.');
  if (!isRecord(log.carddata)) throw new Error('The DraftLog card data is missing or malformed.');

  const seats = [];
  let skippedBots = 0;
  for (const [key, user] of Object.entries(log.users)) {
    const playerId = readId(key, 'Draftmancer player ID');
    if (!isRecord(user) || user.userID !== playerId) {
      throw new Error(`The DraftLog seat "${playerId}" has a missing or mismatched player ID.`);
    }
    if (typeof user.isBot !== 'boolean') throw new Error(`The DraftLog seat "${playerId}" is missing its bot flag.`);
    if (user.isBot) {
      skippedBots += 1;
      continue;
    }
    const name = readText(user.userName, `player name for "${playerId}"`);
    seats.push({
      playerId,
      name,
      ...previewPool(user.cards, log.carddata),
      ...previewDeck(user.decklist, log.carddata),
    });
  }
  return { source, seats, skippedBots };
}

function readHandoffBoard(board, field) {
  if (!Array.isArray(board)) throw new Error(`Invalid roster ${field.toLowerCase()}.`);
  const seen = new Set();
  return board.map((card) => {
    if (!isRecord(card)) throw new Error(`Invalid ${field.toLowerCase()} card.`);
    const cardId = readId(card.cardId, `${field} card ID`);
    if (seen.has(cardId)) throw new Error(`Duplicate ${field.toLowerCase()} card ID "${cardId}". Use a quantity instead.`);
    seen.add(cardId);
    if (!Number.isSafeInteger(card.quantity) || card.quantity < 1) {
      throw new Error(`Invalid quantity for ${field.toLowerCase()} card "${cardId}".`);
    }
    return {
      cardId, name: readText(card.name, 'card name'), quantity: card.quantity, ...optionalCardMetadata(card),
    };
  });
}

function readHandoffDeck(deck) {
  if (!isRecord(deck)) throw new Error('Invalid roster deck.');
  const mainboard = readHandoffBoard(deck.mainboard, 'Mainboard');
  const sideboard = readHandoffBoard(deck.sideboard, 'Sideboard');
  const basicLands = readBasicLands(deck.basicLands);
  if (!hasDeckCards(mainboard, sideboard, basicLands)) throw new Error('A carried deck must contain cards or basic lands.');
  return basicLands === undefined ? { mainboard, sideboard } : { mainboard, sideboard, basicLands };
}

function readHandoff(roster) {
  if (roster.format !== rosterFormat) throw new Error('Unsupported Cube Buddy roster format.');
  if (roster.schemaVersion !== 1) throw new Error('Only Cube Buddy roster version 1 is supported.');
  if (!isRecord(roster.source) || roster.source.provider !== 'draftmancer') {
    throw new Error('Invalid roster source. This version accepts a Draftmancer source.');
  }
  const { sessionId, draftTime, logVersion } = roster.source;
  const source = readSource(sessionId, draftTime, logVersion);
  if (!Array.isArray(roster.players) || !roster.players.length) throw new Error('Confirm at least one attending player.');

  const seen = new Set();
  const players = roster.players.map((entry) => {
    if (!isRecord(entry)) throw new Error('Invalid player in roster.');
    const playerId = readId(entry.playerId, 'player ID');
    if (seen.has(playerId)) throw new Error(`Duplicate player ID "${playerId}" in roster.`);
    seen.add(playerId);
    const player = { playerId, name: readText(entry.name, 'player name') };
    if (entry.deck !== undefined) player.deck = readHandoffDeck(entry.deck);
    return player;
  });
  return { format: rosterFormat, schemaVersion: 1, source, players };
}

export function parseDraftmancerLog(contents) {
  return readDraftLog(readJson(contents));
}

export function parseDraftRosterHandoff(contents) {
  return readHandoff(readJson(contents));
}

export function parseDraftRosterFile(contents) {
  const document = readJson(contents);
  if (Object.hasOwn(document, 'format')) return { roster: readHandoff(document) };
  return { review: readDraftLog(document) };
}

export function confirmDraftRoster(review, choices = new Map()) {
  const players = [];
  for (const seat of review.seats) {
    const choice = choices.get(seat.playerId);
    if (choice?.present === false) continue;
    const player = { playerId: seat.playerId, name: seat.name };
    if (choice?.includeDeck) {
      if (seat.deckStatus !== 'available') throw new Error(`${seat.name} has no complete deck to carry over.`);
      player.deck = seat.deck;
    }
    players.push(player);
  }
  return readHandoff({ format: rosterFormat, schemaVersion: 1, source: review.source, players });
}
