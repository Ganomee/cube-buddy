import { newId } from './ids.js';
import { createCardCopy } from './card-copies.js';

function parseCsv(input) {
  if (typeof input !== 'string') throw new TypeError('CSV text is required');
  const rows = [];
  let cells = [];
  let field = '';
  let state = 'start';
  let line = 1;
  let rowLine = 1;

  const finishField = () => {
    cells.push(field);
    field = '';
    state = 'start';
  };
  const finishRow = () => {
    finishField();
    if (cells.some((value) => value !== '')) rows.push({ cells, line: rowLine });
    cells = [];
    rowLine = line + 1;
  };

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (state === 'quoted') {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        state = 'afterQuote';
      } else {
        field += char;
        if (char === '\n') line++;
      }
      continue;
    }
    if (char === '"') {
      if (state !== 'start') throw new Error(`Invalid CSV quote on line ${line}`);
      state = 'quoted';
    } else if (char === ',') {
      finishField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index++;
      finishRow();
      line++;
    } else if (state === 'afterQuote') {
      throw new Error(`Invalid CSV text after quote on line ${line}`);
    } else {
      field += char;
      state = 'plain';
    }
  }
  if (state === 'quoted') throw new Error(`Unclosed quote in CSV on line ${rowLine}`);
  if (field !== '' || cells.length > 0 || state === 'afterQuote') finishRow();
  return rows;
}

export function importCubeCobraCsv(csv, { cubeId, versionId } = {}) {
  if (typeof cubeId !== 'string' || !cubeId.trim() || typeof versionId !== 'string' || !versionId.trim()) {
    throw new TypeError('cubeId and versionId are required');
  }
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new Error('Cube Cobra CSV has no header');
  const columns = header.cells.map((name) => name.trim().toLowerCase());
  if (!columns.includes('name')) throw new Error('Cube Cobra CSV needs a name column');
  if (new Set(columns).size !== columns.length) throw new Error('Cube Cobra CSV has duplicate columns');

  const definitions = new Map();
  const entries = [];
  const review = [];
  for (const row of rows) {
    if (row.cells.length > columns.length) throw new Error(`Cube Cobra CSV row ${row.line} has extra columns`);
    const values = Object.fromEntries(columns.map((column, index) => [column, row.cells[index] ?? '']));
    const name = values.name.trim();
    const key = name ? name.toLowerCase() : `unresolved-row-${row.line}`;
    if (!definitions.has(key)) definitions.set(key, newId());
    const cardId = definitions.get(key);
    const copy = createCardCopy({ cardId });
    const entry = {
      ...copy,
      sourceRow: row.line,
      name,
      board: values.board || 'mainboard',
      printing: { set: values.set, collectorNumber: values['collector number'] },
      artwork: { frontUrl: values['image url'], backUrl: values['image back url'] },
      source: values,
    };
    entries.push(entry);
    if (!name) review.push({ sourceRow: row.line, reason: 'Missing card name' });
  }
  return { cube: { cubeId, versionId, entries }, review };
}
