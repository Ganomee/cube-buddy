import React, { useState } from 'react';
import { getCubeCobraRecordsLinks, getCubeCobraRecordUrl } from '../src/cube-cobra-record-link.js';

function SpectatorLink({ url }) {
  const [copyMessage, setCopyMessage] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Spectator link copied.');
    } catch {
      setCopyMessage('Clipboard unavailable. Select and copy the URL below.');
    }
  }

  return (
    <div className="import-form">
      <h3>Share with spectators</h3>
      <div className="tournament-actions">
        <a href={url} target="_blank" rel="noreferrer">Open spectator link</a>
        <button type="button" className="secondary" onClick={copy}>Copy spectator link</button>
      </div>
      {copyMessage && <p role="status">{copyMessage}</p>}
      <label>Spectator URL<input type="text" value={url} readOnly onFocus={(event) => event.target.select()} /></label>
    </div>
  );
}

function RecordOrganizer({ cube, links, onSetRecord }) {
  const [draftUrl, setDraftUrl] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const recordUrl = getCubeCobraRecordUrl(cube.cubeCobraRecordId);

  function updateRecord(url) {
    try {
      onSetRecord(url);
      setDraftUrl('');
      setConfirmed(false);
      setFeedback({ message: url === null ? 'Record removed from this cube.' : 'Record saved for this cube.' });
    } catch (cause) {
      setFeedback({ error: cause.message });
    }
  }

  function changeRecordUrl(event) {
    setDraftUrl(event.target.value);
    setConfirmed(false);
    setFeedback(null);
  }

  function attachRecord(event) {
    event.preventDefault();
    if (confirmed) updateRecord(draftUrl);
  }

  return (
    <div className="tournament-content">
      <div>
        <p>Run pairings, the round clock, and scores in Cube Cobra using your organizer login. Players can report scores to you in person.</p>
        <div className="tournament-actions">
          <a href={links.list} target="_blank" rel="noreferrer">Open cube Records</a>
          <a href={links.create} target="_blank" rel="noreferrer">Create event in Cube Cobra</a>
          {recordUrl && <a href={recordUrl} target="_blank" rel="noreferrer">Open live Record</a>}
        </div>
        <p>Cube Cobra applies the cube’s visibility to its Record. Open the Record there to check whether it’s available.</p>
        {recordUrl && <SpectatorLink key={recordUrl} url={recordUrl} />}
      </div>
      <form className="import-form" onSubmit={attachRecord}>
        <h3>{recordUrl ? 'Organizer-confirmed Record' : 'Attach an existing Record'}</h3>
        <p>Paste the URL from the Record page for this cube.</p>
        <label>Cube Cobra Record URL<input type="text" inputMode="url" autoComplete="off" spellCheck={false} value={draftUrl} onChange={changeRecordUrl} required /></label>
        <label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required />I confirm this Record belongs to the selected cube.</label>
        <div className="tournament-actions">
          <button type="submit">{recordUrl ? 'Replace Record' : 'Attach Record'}</button>
          {recordUrl && <button type="button" className="secondary" onClick={() => updateRecord(null)}>Remove Record</button>}
        </div>
        {feedback?.error && <p role="alert" className="notice error">{feedback.error}</p>}
        {feedback?.message && <p role="status">{feedback.message}</p>}
      </form>
    </div>
  );
}

export default function LiveTournament({ cubes, cube, onSelectCube, onSetRecord }) {
  const links = getCubeCobraRecordsLinks(cube?.cubeId);

  return (
    <section className="panel" id="live-tournament" aria-labelledby="live-tournament-title">
      <div className="section-head">
        <h2 id="live-tournament-title">Live tournament</h2>
        {cube && (
          <label>Selected cube<select value={cube.cubeId} onChange={(event) => onSelectCube(event.target.value)}>
            {cubes.map(({ cubeId }) => <option key={cubeId} value={cubeId}>{cubeId}</option>)}
          </select></label>
        )}
      </div>
      {links ? <RecordOrganizer key={cube.cubeId} cube={cube} links={links} onSetRecord={onSetRecord} /> : (
        <p>{cube ? 'This cube needs a Cube Cobra cube ID to use its Records page.' : 'Import a Cube Cobra cube to open its Records page.'}</p>
      )}
    </section>
  );
}
