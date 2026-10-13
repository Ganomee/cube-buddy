import React, { useState } from 'react';
import { getCubePerformance } from '../src/cube-performance.js';

function shortId(copyId) {
  return copyId.slice(-8);
}

export default function App({ store }) {
  const [state, setState] = useState(() => store.getState());
  const [cubeId, setCubeId] = useState(() => state.cubes[0]?.cubeId ?? '');
  const [newCubeId, setNewCubeId] = useState('');
  const [csv, setCsv] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [selectedCopyId, setSelectedCopyId] = useState(null);
  const [wins, setWins] = useState('');
  const [games, setGames] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const cube = state.cubes.find((item) => item.cubeId === cubeId);
  const performance = cube ? getCubePerformance(state, cubeId) : null;
  const entries = cube?.versions.find((version) => version.versionId === cube.activeVersionId)?.entries ?? [];
  const selectedEntry = entries.find((entry) => entry.copyId === selectedCopyId);
  const selectedHistory = selectedCopyId ? state.cycles[selectedCopyId] : null;
  const currentCycle = selectedHistory?.at(-1);

  function refresh() {
    setState(store.getState());
  }

  function selectCopy(copyId) {
    const history = state.cycles[copyId];
    const latest = history?.at(-1)?.snapshots.at(-1);
    setSelectedCopyId(copyId);
    setWins(String(latest?.wins ?? 0));
    setGames(String((latest?.wins ?? 0) + (latest?.losses ?? 0)));
    setMessage('');
    setError('');
  }

  function openCopyFromQr(event) {
    event.preventDefault();
    const payload = qrPayload.trim();
    const copyId = payload.startsWith('cube-buddy:copy:') ? payload.slice('cube-buddy:copy:'.length) : '';
    const match = state.cubes.flatMap((item) => item.versions.flatMap((version) => version.entries.map((entry) => ({ cubeId: item.cubeId, entry })))).find(({ entry }) => entry.copyId === copyId);
    if (!match) {
      setError('No imported physical copy matches this QR. Check the scan or import its cube.');
      return;
    }
    setCubeId(match.cubeId);
    selectCopy(copyId);
    setQrPayload('');
  }

  function importCube(event) {
    event.preventDefault();
    try {
      const id = newCubeId.trim();
      const result = store.importCubeCsv(csv, { cubeId: id });
      refresh();
      setCubeId(id);
      setSelectedCopyId(null);
      setMessage(`Imported ${result.cube.entries.length} physical copies. ${result.review.length} rows need review.`);
      setError('');
    } catch (cause) {
      setError(cause.message);
    }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (file) setCsv(await file.text());
  }

  function saveReview(event) {
    event.preventDefault();
    try {
      const result = store.reviewGameMarks(selectedCopyId, {
        games: Number(games),
        wins: Number(wins),
        capturedAt: new Date().toISOString(),
      });
      if (result.status === 'needs-review') {
        setError('These totals are lower than the previous review. Check for a correction or archive the erased cycle first. Nothing was saved.');
        setMessage('');
        return;
      }
      refresh();
      setError('');
      setMessage(result.delta.wins + result.delta.losses === 0 ? 'Totals reviewed. No new outcomes were added.' : `Saved ${result.delta.wins} new wins and ${result.delta.losses} new losses.`);
    } catch (cause) {
      setError(cause.message);
    }
  }

  function archive() {
    if (!window.confirm('Archive this cycle? Erase the physical marks before using the next cycle.')) return;
    try {
      store.archiveCopy(selectedCopyId, { archivedAt: new Date().toISOString() });
      refresh();
      setWins('0');
      setGames('0');
      setError('');
      setMessage('Cycle archived. A new cycle is ready for this copy.');
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <span className="eyebrow">Physical cube, practical feedback</span>
        <h1>Cube Buddy</h1>
        <p>Import your Cube Cobra list, review marked card backs, and see the recorded outcomes on your cube.</p>
      </header>

      <section className="panel import-panel" aria-labelledby="import-title">
        <div>
          <h2 id="import-title">Import a cube</h2>
          <p>Start with a Cube Cobra CSV export. Each row becomes a distinct physical copy.</p>
        </div>
        <form onSubmit={importCube} className="import-form">
          <label>Cube ID<input value={newCubeId} onChange={(event) => setNewCubeId(event.target.value)} placeholder="my-cube" required /></label>
          <label>Cube Cobra CSV<textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="Paste exported CSV here" required /></label>
          <label className="file-label">Or choose a CSV file<input type="file" accept=".csv,text/csv" onChange={chooseFile} /></label>
          <button type="submit">Import cube</button>
        </form>
      </section>

      {state.cubes.length > 0 && (
        <section className="panel" aria-labelledby="cube-title">
          <div className="section-head">
            <div>
              <h2 id="cube-title">Cube performance</h2>
              <p>Player-selected relevant-game outcomes. Unmarked cards have no recorded rate.</p>
            </div>
            <label>Selected cube<select value={cubeId} onChange={(event) => { setCubeId(event.target.value); setSelectedCopyId(null); }}>
              {state.cubes.map((item) => <option key={item.cubeId} value={item.cubeId}>{item.cubeId}</option>)}
            </select></label>
          </div>
          <form onSubmit={openCopyFromQr} className="import-form">
            <label>Scan or paste copy QR<input value={qrPayload} onChange={(event) => setQrPayload(event.target.value)} placeholder="cube-buddy:copy:..." required /></label>
            <button type="submit">Open copy</button>
          </form>
          <div className="card-list">
            {performance.cards.map((card) => (
              <article key={card.cardId} className="card-row">
                <div>
                  <h3>{card.name || 'Unresolved card'}</h3>
                  <p>{card.copyCount} {card.copyCount === 1 ? 'copy' : 'copies'} · {card.lastCaptureAt ? `Last reviewed ${new Date(card.lastCaptureAt).toLocaleDateString()}` : 'No observations yet'}</p>
                </div>
                <div className="card-stat">
                  <strong>{card.totals.wins} W / {card.totals.losses} L</strong>
                  <span>{card.rate === null ? 'No observations yet' : `${(card.rate * 100).toFixed(1)}% of ${card.totals.outcomes} recorded relevant-game outcomes`}</span>
                </div>
                <div className="copy-actions">
                  {card.copies.map((copy) => <button key={copy.copyId} type="button" onClick={() => selectCopy(copy.copyId)} aria-pressed={selectedCopyId === copy.copyId}>{card.name || 'Unresolved card'} copy {shortId(copy.copyId)}</button>)}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedEntry && (
        <section className="panel review-panel" aria-labelledby="review-title">
          <div>
            <span className="eyebrow">Physical copy {shortId(selectedCopyId)}</span>
            <h2 id="review-title">Review {selectedEntry.name || 'unresolved card'}</h2>
            <p>Enter the cumulative Games and Wins marks visible on this copy. Losses are calculated as Games minus Wins. Repeating totals adds no outcomes.</p>
            <p className="cycle-label">Cycle {selectedHistory.length} · {currentCycle.snapshots.length} reviewed snapshots</p>
          </div>
          <form onSubmit={saveReview} className="review-form">
            <label>Reviewed games<input type="number" min="0" max="50" step="1" value={games} onChange={(event) => setGames(event.target.value)} required /></label>
            <label>Reviewed wins<input type="number" min="0" max="50" step="1" value={wins} onChange={(event) => setWins(event.target.value)} required /></label>
            <button type="submit">Save reviewed totals</button>
            <button className="secondary" type="button" onClick={archive}>Archive and reset cycle</button>
          </form>
        </section>
      )}

      {message && <p role="status" className="notice success">{message}</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
    </main>
  );
}
