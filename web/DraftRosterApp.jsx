import React, { useRef, useState } from 'react';
import {
  confirmDraftRoster,
  DRAFT_ROSTER_FILE_LIMIT,
  DRAFT_ROSTER_FILE_SIZE_ERROR,
  parseDraftRosterFile,
  parseDraftRosterHandoff,
} from '../src/draft-roster.js';

const storageKey = 'cube-buddy:draft-roster:v1';
const storageWarning = 'This browser could not save the roster. Download it before leaving the page.';
const landNames = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
const deckLabels = {
  omitted: 'No decklist in log',
  empty: 'Empty decklist in log',
  withheld: 'Decklist withheld by Draftmancer',
  invalid: 'Decklist unavailable',
};

function loadSavedRoster() {
  try {
    const contents = window.localStorage.getItem(storageKey);
    return contents ? { roster: parseDraftRosterHandoff(contents) } : {};
  } catch {
    return { warning: 'The saved roster could not be restored. Open your roster file or DraftLog to continue.' };
  }
}

function rosterBlob(roster) {
  const blob = new Blob([JSON.stringify(roster)], { type: 'application/json' });
  if (blob.size > DRAFT_ROSTER_FILE_LIMIT) {
    throw new Error('The roster is larger than 16 MiB. Deselect some decks and confirm again.');
  }
  return blob;
}

function downloadRoster(roster) {
  const url = URL.createObjectURL(rosterBlob(roster));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cube-buddy-draft-roster.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readFile(file) {
  if (file.size > DRAFT_ROSTER_FILE_LIMIT) throw new Error(DRAFT_ROSTER_FILE_SIZE_ERROR);
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('The file must contain UTF-8 JSON text.');
  }
}

function countLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function SourceSummary({ source }) {
  const date = new Date(source.draftTime);
  return (
    <p className="roster-source">
      Draftmancer v{source.logVersion} · <bdi>{source.sessionId}</bdi> ·{' '}
      <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>
    </p>
  );
}

function DeckBoard({ title, cards }) {
  return (
    <div>
      <h3>{title}</h3>
      {cards.length ? (
        <ul>
          {cards.map((card) => <li key={card.cardId}>{card.quantity} × <bdi>{card.name}</bdi></li>)}
        </ul>
      ) : <p>Empty</p>}
    </div>
  );
}

function DeckPreview({ deck }) {
  return (
    <details className="roster-deck">
      <summary>View deck</summary>
      <div className="roster-boards">
        <DeckBoard title="Mainboard" cards={deck.mainboard} />
        <DeckBoard title="Sideboard" cards={deck.sideboard} />
        {deck.basicLands && Object.keys(deck.basicLands).length > 0 && (
          <div>
            <h3>Added basic lands</h3>
            <ul>
              {Object.entries(landNames).filter(([code]) => Object.hasOwn(deck.basicLands, code)).map(([code, name]) => (
                <li key={code}>{deck.basicLands[code]} × {name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function SeatPreview({ seat, choice, updateChoice }) {
  const present = choice?.present !== false;
  return (
    <fieldset className="roster-seat">
      <legend><bdi>{seat.name}</bdi> <small>{seat.playerId}</small></legend>
      <div className="roster-seat-controls">
        <label className="checkbox-label">
          <input type="checkbox" checked={present} onChange={(event) => updateChoice({ present: event.target.checked })} />
          Attending
        </label>
        {seat.deck && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={present && Boolean(choice?.includeDeck)}
              disabled={!present}
              onChange={(event) => updateChoice({ includeDeck: event.target.checked })}
            />
            Carry over deck
          </label>
        )}
      </div>
      {seat.poolSize !== undefined && <p>{countLabel(seat.poolSize, 'card')} in draft pool</p>}
      {seat.poolError && <p className="roster-warning">{seat.poolError}</p>}
      {seat.deck ? <DeckPreview deck={seat.deck} /> : <p>{deckLabels[seat.deckStatus]}</p>}
      {seat.deckError && <p className="roster-warning">{seat.deckError}</p>}
    </fieldset>
  );
}

export default function DraftRosterApp() {
  const [saved, setSaved] = useState(loadSavedRoster);
  const [review, setReview] = useState(null);
  const [choices, setChoices] = useState(() => new Map());
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const latestRead = useRef(0);

  function saveRoster(roster) {
    // Check that the file can be reopened before changing the current roster.
    rosterBlob(roster);
    let warning = '';
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(roster));
    } catch {
      warning = storageWarning;
    }
    setSaved({ roster, warning });
    setReview(null);
  }

  async function openFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const readId = ++latestRead.current;
    setError('');
    setStatus('');
    setOpening(true);
    try {
      const contents = await readFile(file);
      if (readId !== latestRead.current) return;
      const opened = parseDraftRosterFile(contents);
      if (opened.roster) {
        saveRoster(opened.roster);
        setStatus('Roster file opened.');
      } else {
        setChoices(new Map());
        setReview(opened.review);
      }
    } catch (failure) {
      if (readId === latestRead.current) setError(failure.message);
    } finally {
      if (readId === latestRead.current) setOpening(false);
    }
  }

  function updateChoice(id, update) {
    setChoices((previous) => new Map(previous).set(id, { ...previous.get(id), ...update }));
  }

  function confirm() {
    setError('');
    try {
      saveRoster(confirmDraftRoster(review, choices));
    } catch (failure) {
      setError(failure.message);
    }
  }

  const attending = review?.seats.filter(({ playerId }) => choices.get(playerId)?.present !== false).length;

  return (
    <main className="shell roster-shell">
      <header className="masthead">
        <a className="header-link" href="/">Cube Buddy</a>
        <h1>Draft roster</h1>
        <p>Review attendance and choose which decklists to bring to paper play.</p>
      </header>

      <section className="panel roster-panel" aria-labelledby="open-roster">
        <h2 id="open-roster">Open a file</h2>
        <p>Choose a Draftmancer DraftLog (.txt or .json) or a confirmed Cube Buddy roster (.json). Files stay in this browser.</p>
        <label className="file-label">
          Draft log or roster file
          <input type="file" accept=".txt,.json" onChange={openFile} />
        </label>
        {opening && <p role="status">Opening file…</p>}
        {status && <p className="notice success" role="status">{status}</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        {saved.warning && <p className="roster-warning" role="status">{saved.warning}</p>}
      </section>

      {review && (
        <section className="panel roster-panel" aria-labelledby="review-roster">
          <h2 id="review-roster">Review seats</h2>
          <SourceSummary source={review.source} />
          <div className="roster-totals">
            <p>{attending} of {countLabel(review.seats.length, 'human seat')} attending</p>
            <p>{countLabel(review.skippedBots, 'bot')} skipped</p>
          </div>
          {review.seats.length === 0 && <p>No human seats are available in this log.</p>}
          {review.seats.map((seat) => (
            <SeatPreview
              key={seat.playerId}
              seat={seat}
              choice={choices.get(seat.playerId)}
              updateChoice={(update) => updateChoice(seat.playerId, update)}
            />
          ))}
          <div className="roster-actions">
            <button type="button" disabled={opening || attending === 0} onClick={confirm}>Confirm roster</button>
            <button type="button" className="secondary" disabled={opening} onClick={() => {
              setReview(null);
              setError('');
            }}>Cancel review</button>
          </div>
        </section>
      )}

      {!review && saved.roster && (
        <section className="panel roster-panel" aria-labelledby="confirmed-roster">
          <h2 id="confirmed-roster">Confirmed roster</h2>
          <SourceSummary source={saved.roster.source} />
          <p>{countLabel(saved.roster.players.length, 'player')} confirmed</p>
          <ul className="roster-players">
            {saved.roster.players.map(({ playerId, name, deck }) => (
              <li key={playerId}>
                <bdi>{name}</bdi> <small>{playerId}</small>
                {deck ? <DeckPreview deck={deck} /> : <p>No deck carried over</p>}
              </li>
            ))}
          </ul>
          <button type="button" disabled={opening} onClick={() => downloadRoster(saved.roster)}>Download roster</button>
        </section>
      )}
    </main>
  );
}
