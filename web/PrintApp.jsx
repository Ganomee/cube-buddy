import React, { useMemo, useRef, useState } from 'react';
import { fetchCubeCobraCsv } from '../src/cube-cobra-client.js';
import { createDefaultPrintLayout, updatePrintOverlay } from '../src/print-layout.js';
import { createPrintProject, DEFAULT_PROXXIED_PRINT_SETTINGS } from '../src/print-project.js';

const BACK_URL = new URL('../src/cardback nice.png', import.meta.url).href;

function activeEntries(state, cubeId) {
  const cube = state.cubes.find((item) => item.cubeId === cubeId);
  return cube?.versions.find((version) => version.versionId === cube.activeVersionId)?.entries ?? [];
}

function latestTotals(state, copyId) {
  const snapshot = state.cycles[copyId]?.at(-1)?.snapshots?.at(-1);
  const wins = snapshot?.wins ?? 0;
  const games = wins + (snapshot?.losses ?? 0);
  return { wins, games, percentage: games ? Math.round((wins / games) * 100) : 0 };
}

function Grid({ overlay }) {
  const cells = Array.from({ length: overlay.grid.rows * overlay.grid.columns });
  return <div className="print-grid" style={{ gridTemplateColumns: `repeat(${overlay.grid.columns}, 1fr)` }}>
    {cells.map((_, index) => <i key={index} />)}
  </div>;
}

function OverlayContent({ id, overlay, samples }) {
  if (overlay.grid) return <Grid overlay={overlay} />;
  if (id === 'qr') return <span className="fake-qr">▦</span>;
  const values = {
    'draft-average': `AVG ${samples.draftAverage}`,
    'draft-count': `DRAFTS ${samples.draftCount}`,
    'win-percentage': `WIN ${samples.winPercentage}%`,
    'game-count': `GAMES ${samples.gameCount}`,
    'copy-number': samples.copyNumber,
    name: samples.name,
  };
  return values[id] ?? overlay.label;
}

export default function PrintApp({ store, fetcher = globalThis.fetch }) {
  const initialState = useMemo(() => store.getState(), [store]);
  const initialCube = initialState.cubes[0];
  const initialEntry = initialCube ? activeEntries(initialState, initialCube.cubeId)[0] : null;
  const initialTotals = initialEntry ? latestTotals(initialState, initialEntry.copyId) : null;
  const [projectState, setProjectState] = useState(initialState);
  const [cubeId, setCubeId] = useState(initialCube?.cubeId ?? '');
  const [source, setSource] = useState(initialCube?.cubeId ?? '');
  const [layout, setLayout] = useState(createDefaultPrintLayout);
  const [selectedId, setSelectedId] = useState('games-grid');
  const [background, setBackground] = useState(BACK_URL);
  const [duplexMode, setDuplexMode] = useState('interleaved');
  const [settings, setSettings] = useState({ ...DEFAULT_PROXXIED_PRINT_SETTINGS });
  const [printCurrentState, setPrintCurrentState] = useState(true);
  const [samples, setSamples] = useState({
    draftAverage: '7.5', draftCount: '20',
    winPercentage: String(initialTotals?.percentage ?? 55), gameCount: String(initialTotals?.games ?? 40),
    copyNumber: initialEntry?.copyId.slice(-9) ?? '000000001', name: initialEntry?.name ?? 'Example card name',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [planJson, setPlanJson] = useState('');
  const [gesture, setGesture] = useState(null);
  const canvasRef = useRef(null);
  const entries = activeEntries(projectState, cubeId);
  const selected = layout.overlays[selectedId];

  function updateOverlay(id, changes) {
    setLayout((current) => updatePrintOverlay(current, id, changes));
  }

  function updateGrid(key, value) {
    const number = Number(value);
    if (number > 0) updateOverlay(selectedId, { grid: { [key]: key === 'cellSizeMm' ? number : Math.round(number) } });
  }

  async function loadCube(event) {
    event.preventDefault();
    try {
      const loaded = await fetchCubeCobraCsv(source, { fetcher });
      let next = store.getState();
      if (!next.cubes.some((cube) => cube.cubeId === loaded.cubeId)) {
        store.importCubeCsv(loaded.csv, { cubeId: loaded.cubeId });
        next = store.getState();
      }
      const loadedEntries = activeEntries(next, loaded.cubeId);
      setProjectState(next);
      setCubeId(loaded.cubeId);
      setMessage(`Loaded ${loaded.name} with ${loadedEntries.length} printable ${loadedEntries.length === 1 ? 'card' : 'cards'}.`);
      setError('');
      if (printCurrentState && loadedEntries[0]) useStoredValues(next, loadedEntries[0]);
    } catch (cause) {
      setError(cause.message);
      setMessage('');
    }
  }

  function useStoredValues(state = projectState, entry = entries[0]) {
    if (!entry) return;
    const totals = latestTotals(state, entry.copyId);
    setSamples((current) => ({ ...current, name: entry.name, copyNumber: entry.copyId.slice(-9), gameCount: String(totals.games), winPercentage: String(totals.percentage) }));
  }

  async function uploadBackground(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackground(String(reader.result));
    reader.readAsDataURL(file);
  }

  function beginGesture(event, id, kind) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    const rect = canvasRef.current.getBoundingClientRect();
    const overlay = layout.overlays[id];
    setGesture({ id, kind, startX: event.clientX, startY: event.clientY, rect, overlay });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveGesture(event) {
    if (!gesture) return;
    const dx = (event.clientX - gesture.startX) * layout.widthMm / gesture.rect.width;
    const dy = (event.clientY - gesture.startY) * layout.heightMm / gesture.rect.height;
    if (gesture.kind === 'move') updateOverlay(gesture.id, { xMm: Math.max(0, gesture.overlay.xMm + dx), yMm: Math.max(0, gesture.overlay.yMm + dy) });
    else updateOverlay(gesture.id, { widthMm: Math.max(1, gesture.overlay.widthMm + dx), heightMm: Math.max(1, gesture.overlay.heightMm + dy) });
  }

  function prepare(event) {
    event.preventDefault();
    try {
      const project = createPrintProject(entries, { printSettings: settings, duplexMode });
      const currentStateByCopyId = printCurrentState ? Object.fromEntries(entries.map((entry) => {
        const totals = latestTotals(projectState, entry.copyId);
        return [entry.copyId, { games: totals.games, wins: totals.wins, winPercentage: totals.percentage }];
      })) : {};
      setPlanJson(JSON.stringify({ ...project, cardBackLayout: layout, printCurrentState, currentStateByCopyId }, null, 2));
      setMessage(`Prepared ${project.pages.length} pages for ${project.summary.trackedCards} tracked cards.`);
      setError('');
    } catch (cause) {
      setError(cause.message);
    }
  }

  return <main className="shell print-shell">
    <header className="masthead print-masthead">
      <span className="eyebrow">Cube Buddy print studio</span>
      <h1>QBuddy Print</h1>
      <p>Arrange an erasable card back, preview real values, and prepare mirrored pages for Proxxied.</p>
      <a className="header-link" href="/">Back to Cube Buddy</a>
    </header>

    {message && <p className="notice success">{message}</p>}
    {error && <p className="notice error">{error}</p>}

    <section className="panel source-bar">
      <form onSubmit={loadCube}>
        <label>Cube Cobra link or ID<input value={source} onChange={(event) => setSource(event.target.value)} /></label>
        <button type="submit">Load cube for printing</button>
      </form>
      <label className="file-label">Upload card back<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadBackground} /></label>
    </section>

    <section className="print-workspace">
      <aside className="panel overlay-list">
        <h2>Fields</h2>
        <p>Each field can be shown, moved, and sized independently.</p>
        {Object.entries(layout.overlays).map(([id, overlay]) => <div className={selectedId === id ? 'overlay-row selected' : 'overlay-row'} key={id}>
          <label className="checkbox-label"><input type="checkbox" checked={overlay.enabled} onChange={(event) => updateOverlay(id, { enabled: event.target.checked })} />Show {overlay.label}</label>
          <button type="button" className="secondary" onClick={() => setSelectedId(id)}>Edit {overlay.label}</button>
        </div>)}
      </aside>

      <section className="panel canvas-panel">
        <div className="card-canvas" ref={canvasRef} style={{ aspectRatio: `${layout.widthMm}/${layout.heightMm}`, backgroundImage: `url("${background}")` }} onPointerMove={moveGesture} onPointerUp={() => setGesture(null)} onPointerCancel={() => setGesture(null)}>
          {Object.entries(layout.overlays).filter(([, overlay]) => overlay.enabled).map(([id, overlay]) => <div key={id} data-testid={`overlay-${id}`} className={`canvas-overlay ${selectedId === id ? 'active' : ''} ${overlay.grid ? 'grid-overlay' : ''}`} style={{ left: `${overlay.xMm}mm`, top: `${overlay.yMm}mm`, width: `${overlay.widthMm}mm`, height: `${overlay.heightMm}mm` }} onPointerDown={(event) => beginGesture(event, id, 'move')}>
            <OverlayContent id={id} overlay={overlay} samples={samples} />
            {selectedId === id && <button type="button" aria-label={`Resize ${overlay.label}`} className="resize-handle" onPointerDown={(event) => beginGesture(event, id, 'resize')} />}
          </div>)}
        </div>
        <p className="canvas-hint">Drag a field to move it. Drag its lower-right handle to resize it.</p>
      </section>

      <aside className="panel inspector">
        <h2>{selected.label}</h2>
        <div className="geometry-fields">
          {['xMm', 'yMm', 'widthMm', 'heightMm'].map((key) => <label key={key}>{({ xMm: 'Left (mm)', yMm: 'Top (mm)', widthMm: 'Width (mm)', heightMm: 'Height (mm)' })[key]}<input type="number" min="0" step="0.1" value={selected[key]} onChange={(event) => updateOverlay(selectedId, { [key]: Number(event.target.value) })} /></label>)}
        </div>
        {selected.grid && <div className="geometry-fields grid-fields">
          <label>Grid rows<input type="number" min="1" value={selected.grid.rows} onChange={(event) => updateGrid('rows', event.target.value)} /></label>
          <label>Grid columns<input type="number" min="1" value={selected.grid.columns} onChange={(event) => updateGrid('columns', event.target.value)} /></label>
          <label>Square side (mm)<input type="number" min="0.5" step="0.1" value={selected.grid.cellSizeMm} onChange={(event) => updateGrid('cellSizeMm', event.target.value)} /></label>
        </div>}
        <h3>Preview values</h3>
        <label>Preview draft average<input value={samples.draftAverage} onChange={(event) => setSamples({ ...samples, draftAverage: event.target.value })} /></label>
        <label>Preview draft count<input value={samples.draftCount} onChange={(event) => setSamples({ ...samples, draftCount: event.target.value })} /></label>
        <label>Preview win percentage<input value={samples.winPercentage} onChange={(event) => setSamples({ ...samples, winPercentage: event.target.value })} /></label>
        <label>Preview game count<input value={samples.gameCount} onChange={(event) => setSamples({ ...samples, gameCount: event.target.value })} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={printCurrentState} onChange={(event) => { setPrintCurrentState(event.target.checked); if (event.target.checked) useStoredValues(); }} />Print current Cube Buddy state</label>
      </aside>
    </section>

    <section className="panel">
      <h2>Page setup</h2>
      <p>These settings are carried into the Proxxied print plan. Manual stack mode prints all fronts first, then mirrored backs from the last sheet to the first.</p>
      <form className="print-form" onSubmit={prepare}>
        <div className="print-settings">
          <label>Page ordering<select value={duplexMode} onChange={(event) => setDuplexMode(event.target.value)}><option value="interleaved">Front, back per sheet</option><option value="manual-stack">All fronts, reversed backs</option></select></label>
          <label>Columns<input type="number" min="1" value={settings.cols} onChange={(event) => setSettings({ ...settings, cols: Number(event.target.value) })} /></label>
          <label>Rows<input type="number" min="1" value={settings.rows} onChange={(event) => setSettings({ ...settings, rows: Number(event.target.value) })} /></label>
          <label>Guide width (px)<input type="number" min="0" step="0.1" value={settings.guideWidthPx} onChange={(event) => setSettings({ ...settings, guideWidthPx: Number(event.target.value) })} /></label>
          <label>Page width (in)<input type="number" min="1" step="any" value={settings.pageWidthInches} onChange={(event) => setSettings({ ...settings, pageWidthInches: Number(event.target.value) })} /></label>
          <label>Page height (in)<input type="number" min="1" step="any" value={settings.pageHeightInches} onChange={(event) => setSettings({ ...settings, pageHeightInches: Number(event.target.value) })} /></label>
          <label>Page color<input type="color" value={settings.pdfPageColor} onChange={(event) => setSettings({ ...settings, pdfPageColor: event.target.value })} /></label>
          <button type="submit">Prepare print job</button>
        </div>
        <label>Print job JSON<textarea readOnly value={planJson} /></label>
      </form>
    </section>
  </main>;
}
