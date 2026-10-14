import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCubeCobraCsv } from '../src/cube-cobra-client.js';
import { createDefaultPrintLayout, parsePrintTemplate, serializePrintTemplate, updatePrintOverlay } from '../src/print-layout.js';
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
  const prefix = overlay.text?.showLabel && overlay.text.label.trim() ? `${overlay.text.label.trim()} ` : '';
  const values = {
    'draft-average': `${prefix}${samples.draftAverage}`,
    'draft-count': `${prefix}${samples.draftCount}`,
    'win-percentage': `${prefix}${samples.winPercentage}%`,
    'game-count': `${prefix}${samples.gameCount}`,
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
  const [previewCopyId, setPreviewCopyId] = useState(initialEntry?.copyId ?? '');
  const [layout, setLayout] = useState(createDefaultPrintLayout);
  const [selectedId, setSelectedId] = useState('games-grid');
  const [background, setBackground] = useState(BACK_URL);
  const [duplexMode, setDuplexMode] = useState('interleaved');
  const [settings, setSettings] = useState({ ...DEFAULT_PROXXIED_PRINT_SETTINGS });
  const [paperSize, setPaperSize] = useState('a4');
  const [settingsJson, setSettingsJson] = useState(() => JSON.stringify(DEFAULT_PROXXIED_PRINT_SETTINGS, null, 2));
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
  const historyRef = useRef([]);
  const canvasRef = useRef(null);
  const entries = activeEntries(projectState, cubeId);
  const selected = layout.overlays[selectedId];

  function commitLayout(change) {
    setLayout((current) => {
      const next = typeof change === 'function' ? change(current) : change;
      historyRef.current = [...historyRef.current.slice(-99), current];
      return next;
    });
  }

  function updateOverlay(id, changes) {
    commitLayout((current) => updatePrintOverlay(current, id, changes));
  }

  function updateGrid(key, value) {
    const number = Number(value);
    if (number > 0) updateOverlay(selectedId, { grid: { [key]: ['rows', 'columns'].includes(key) ? Math.round(number) : number } });
  }

  useEffect(() => {
    const undo = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      const previous = historyRef.current.at(-1);
      if (!previous) return;
      historyRef.current = historyRef.current.slice(0, -1);
      setLayout(previous);
    };
    window.addEventListener('keydown', undo);
    return () => window.removeEventListener('keydown', undo);
  }, []);

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
      setPreviewCopyId(loadedEntries[0]?.copyId ?? '');
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

  function selectPreviewCard(copyId) {
    setPreviewCopyId(copyId);
    const entry = entries.find((item) => item.copyId === copyId);
    if (entry) useStoredValues(projectState, entry);
  }

  async function uploadBackground(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackground(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function loadTemplate(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      commitLayout(parsePrintTemplate(await file.text()));
      setMessage(`Loaded print template ${file.name}.`);
      setError('');
    } catch (cause) { setError(cause.message); }
  }

  function saveTemplate() {
    const json = serializePrintTemplate(layout);
    globalThis.localStorage?.setItem?.('cube-buddy:print-template:v1', json);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'cube-buddy-print-template.json'; link.click();
    URL.revokeObjectURL(url);
    setMessage('Saved the print template as JSON and in this browser.');
  }

  function choosePaper(value) {
    setPaperSize(value);
    const sizes = { a4: [210, 297], letter: [215.9, 279.4] };
    if (sizes[value]) setSettings((current) => ({ ...current, pageWidthInches: sizes[value][0] / 25.4, pageHeightInches: sizes[value][1] / 25.4 }));
  }

  function updatePageMm(key, value) {
    setPaperSize('custom');
    setSettings((current) => ({ ...current, [key]: Number(value) / 25.4 }));
  }

  function applySettingsJson() {
    try {
      const parsed = JSON.parse(settingsJson);
      setSettings((current) => ({ ...current, ...parsed }));
      setPaperSize('custom');
      setMessage('Applied the Proxxied-compatible printer profile.');
      setError('');
    } catch { setError('Printer profile must be valid JSON.'); }
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
      <h1>Print Studio</h1>
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
      <label className="file-label">Load overlay template<input type="file" accept="application/json,.json" onChange={loadTemplate} /></label>
      <button type="button" onClick={saveTemplate}>Save print template</button>
    </section>

    <section className="print-workspace">
      <aside className="panel overlay-list">
        <h2>Fields</h2>
        <p>Each field can be shown, moved, and sized independently.</p>
        {Object.entries(layout.overlays).map(([id, overlay]) => <div className={selectedId === id ? 'overlay-row selected' : 'overlay-row'} key={id}>
          <input className="overlay-swatch" data-testid={`legend-${id}`} aria-label={`${overlay.label} color`} type="color" value={overlay.color} style={{ backgroundColor: overlay.color }} onClick={() => setSelectedId(id)} onChange={(event) => updateOverlay(id, { color: event.target.value })} />
          <label className="checkbox-label"><input type="checkbox" checked={overlay.enabled} onChange={(event) => updateOverlay(id, { enabled: event.target.checked })} />Show {overlay.label}</label>
          <button type="button" className="secondary" onClick={() => setSelectedId(id)}>Edit {overlay.label}</button>
        </div>)}
      </aside>

      <section className="panel canvas-panel">
        <div className="card-canvas-frame"><div className="card-canvas" ref={canvasRef} style={{ aspectRatio: `${layout.widthMm}/${layout.heightMm}`, backgroundImage: `url("${background}")` }} onPointerMove={moveGesture} onPointerUp={() => setGesture(null)} onPointerCancel={() => setGesture(null)}>
          {Object.entries(layout.overlays).filter(([, overlay]) => overlay.enabled).map(([id, overlay]) => <div key={id} data-testid={`overlay-${id}`} className={`canvas-overlay ${selectedId === id ? 'active' : ''} ${overlay.grid ? 'grid-overlay' : ''}`} style={{ '--overlay-color': overlay.color, left: `${overlay.xMm}mm`, top: `${overlay.yMm}mm`, width: `${overlay.widthMm}mm`, height: `${overlay.heightMm}mm`, fontFamily: overlay.fontFamily }} onPointerDown={(event) => beginGesture(event, id, 'move')}>
            <OverlayContent id={id} overlay={overlay} samples={samples} />
            {selectedId === id && <button type="button" aria-label={`Resize ${overlay.label}`} className="resize-handle" onPointerDown={(event) => beginGesture(event, id, 'resize')} />}
          </div>)}
        </div></div>
        <p className="canvas-hint">Drag a field to move it. Drag its lower-right handle to resize it.</p>
      </section>

      <aside className="panel inspector">
        <h2>{selected.label}</h2>
        <label>Preview card<select value={previewCopyId} onChange={(event) => selectPreviewCard(event.target.value)}><option value="">Example values</option>{entries.map((entry) => <option value={entry.copyId} key={entry.copyId}>{entry.name} · {entry.copyId.slice(-8)}</option>)}</select></label>
        {!selected.grid && selectedId !== 'qr' && <label>Font<select value={selected.fontFamily} onChange={(event) => updateOverlay(selectedId, { fontFamily: event.target.value })}><option value="Trebuchet MS, sans-serif">Clean sans</option><option value="Georgia, serif">Classic serif</option><option value="Palatino Linotype, serif">Book serif</option><option value="Papyrus, fantasy">Fantasy</option><option value="Courier New, monospace">Monospace</option></select></label>}
        {selected.text && <div className="text-label-controls"><label className="checkbox-label"><input type="checkbox" checked={selected.text.showLabel} onChange={(event) => updateOverlay(selectedId, { text: { showLabel: event.target.checked } })} />Show text label</label><label>Text label<input value={selected.text.label} onChange={(event) => updateOverlay(selectedId, { text: { label: event.target.value } })} /></label></div>}
        <div className="geometry-fields">
          {['xMm', 'yMm', 'widthMm', 'heightMm'].map((key) => <label key={key}>{({ xMm: 'Left (mm)', yMm: 'Top (mm)', widthMm: 'Width (mm)', heightMm: 'Height (mm)' })[key]}<input type="number" min="0" step="0.1" value={selected[key]} onChange={(event) => updateOverlay(selectedId, { [key]: Number(event.target.value) })} /></label>)}
        </div>
        {selected.grid && <div className="geometry-fields grid-fields">
          <label className="checkbox-label"><input type="checkbox" checked={selected.grid.lock === 'unit'} onChange={(event) => updateOverlay(selectedId, { grid: { lock: event.target.checked ? 'unit' : 'total' } })} />Lock cell size</label>
          <label>Grid rows<input type="number" min="1" value={selected.grid.rows} onChange={(event) => updateGrid('rows', event.target.value)} /></label>
          <label>Grid columns<input type="number" min="1" value={selected.grid.columns} onChange={(event) => updateGrid('columns', event.target.value)} /></label>
          <label>Cell width (mm)<input type="number" min="0.5" step="0.1" disabled={selected.grid.lock === 'total'} value={Number(selected.grid.cellWidthMm.toFixed(3))} onChange={(event) => updateGrid('cellWidthMm', event.target.value)} /></label>
          <label>Cell height (mm)<input type="number" min="0.5" step="0.1" disabled={selected.grid.lock === 'total'} value={Number(selected.grid.cellHeightMm.toFixed(3))} onChange={(event) => updateGrid('cellHeightMm', event.target.value)} /></label>
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
      <p>These settings control our Proxxied-compatible PDF layout. The printer profile JSON is an editable settings object, not the generated card data. It can carry page size, grid, guides, bleed, and separate front/back offsets for duplex registration.</p>
      <form className="print-form" onSubmit={prepare}>
        <div className="print-settings">
          <label>Page ordering<select value={duplexMode} onChange={(event) => setDuplexMode(event.target.value)}><option value="interleaved">Front, back per sheet</option><option value="manual-stack">All fronts, reversed backs</option></select></label>
          <label>Paper size<select value={paperSize} onChange={(event) => choosePaper(event.target.value)}><option value="a4">A4</option><option value="letter">US Letter</option><option value="custom">Custom</option></select></label>
          <label>Columns<input type="number" min="1" value={settings.cols} onChange={(event) => setSettings({ ...settings, cols: Number(event.target.value) })} /></label>
          <label>Rows<input type="number" min="1" value={settings.rows} onChange={(event) => setSettings({ ...settings, rows: Number(event.target.value) })} /></label>
          <label>Guide width (px)<input type="number" min="0" step="0.1" value={settings.guideWidthPx} onChange={(event) => setSettings({ ...settings, guideWidthPx: Number(event.target.value) })} /></label>
          <label>Page width (mm)<input type="number" min="1" step="0.1" value={Number((settings.pageWidthInches * 25.4).toFixed(2))} onChange={(event) => updatePageMm('pageWidthInches', event.target.value)} /></label>
          <label>Page height (mm)<input type="number" min="1" step="0.1" value={Number((settings.pageHeightInches * 25.4).toFixed(2))} onChange={(event) => updatePageMm('pageHeightInches', event.target.value)} /></label>
          <label>Front X offset (mm)<input type="number" step="0.1" value={settings.frontOffsetXmm} onChange={(event) => setSettings({ ...settings, frontOffsetXmm: Number(event.target.value) })} /></label>
          <label>Front Y offset (mm)<input type="number" step="0.1" value={settings.frontOffsetYmm} onChange={(event) => setSettings({ ...settings, frontOffsetYmm: Number(event.target.value) })} /></label>
          <label>Back X offset (mm)<input type="number" step="0.1" value={settings.backOffsetXmm} onChange={(event) => setSettings({ ...settings, backOffsetXmm: Number(event.target.value) })} /></label>
          <label>Back Y offset (mm)<input type="number" step="0.1" value={settings.backOffsetYmm} onChange={(event) => setSettings({ ...settings, backOffsetYmm: Number(event.target.value) })} /></label>
          <label>Page color<input type="color" value={settings.pdfPageColor} onChange={(event) => setSettings({ ...settings, pdfPageColor: event.target.value })} /></label>
          <button type="submit">Prepare print job</button>
        </div>
        <div className="profile-json"><label>Proxxied printer profile JSON<textarea value={settingsJson} onChange={(event) => setSettingsJson(event.target.value)} /></label><button type="button" className="secondary" onClick={applySettingsJson}>Apply printer profile JSON</button></div>
        <label>Print job JSON<textarea readOnly value={planJson} /></label>
      </form>
    </section>
  </main>;
}
