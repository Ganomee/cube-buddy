import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../web/App.jsx';
import { createProjectStore } from '../src/project-store.js';

afterEach(cleanup);

function store() {
  const values = new Map();
  return createProjectStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
}

const csv = 'name,Set,Collector Number,image URL\nSol Ring,C21,263,https://art.example/sol-ring.jpg';

test('owner can import a Cube Cobra CSV and find its physical copy', () => {
  render(<App store={store()} />);
  fireEvent.change(screen.getByLabelText('Cube ID'), { target: { value: 'my-cube' } });
  fireEvent.change(screen.getByLabelText('Cube Cobra CSV'), { target: { value: csv } });
  fireEvent.click(screen.getByRole('button', { name: 'Import cube' }));

  expect(screen.getByText('Sol Ring')).toBeTruthy();
  expect(screen.getByText('No observations yet')).toBeTruthy();
});

test('owner can review cumulative counts and see them on the cube card', () => {
  const project = store();
  project.importCubeCsv(csv, { cubeId: 'my-cube' });
  render(<App store={project} />);

  fireEvent.click(screen.getByRole('button', { name: /Sol Ring copy/i }));
  fireEvent.change(screen.getByLabelText('Reviewed games'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Reviewed wins'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed totals' }));

  expect(screen.getByText('6 W / 4 L')).toBeTruthy();
  expect(screen.getByText('60.0% of 10 recorded relevant-game outcomes')).toBeTruthy();
});

test('owner can open the right physical copy by its printed QR payload', () => {
  const project = store();
  const imported = project.importCubeCsv(`${csv}\nSol Ring,C21,263,https://art.example/sol-ring.jpg`, { cubeId: 'my-cube' });
  const target = imported.cube.entries[1].copyId;
  render(<App store={project} />);

  fireEvent.change(screen.getByLabelText('Scan or paste copy QR'), { target: { value: `cube-buddy:copy:${target}` } });
  fireEvent.click(screen.getByRole('button', { name: 'Open copy' }));

  expect(screen.getByText(`Physical copy ${target.slice(-8)}`)).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /Sol Ring copy/i })[1].getAttribute('aria-pressed')).toBe('true');
});

test('owner can export and restore a local project backup', () => {
  const source = store();
  source.importCubeCsv(csv, { cubeId: 'my-cube' });
  render(<App store={source} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  const backup = screen.getByLabelText('Backup JSON').value;
  expect(JSON.parse(backup).project.cubes[0].cubeId).toBe('my-cube');

  cleanup();
  const destination = store();
  render(<App store={destination} />);
  fireEvent.change(screen.getByLabelText('Backup JSON'), { target: { value: backup } });
  fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));
  expect(screen.getByText('Sol Ring')).toBeTruthy();
  expect(destination.getState()).toEqual(source.getState());
});

test('review panel gives the copy sample and last review date with scope', () => {
  const project = store();
  const imported = project.importCubeCsv(csv, { cubeId: 'my-cube' });
  project.reviewGameMarks(imported.cube.entries[0].copyId, { games: 10, wins: 6, capturedAt: '2026-10-13T10:00:00Z' });
  render(<App store={project} />);
  fireEvent.click(screen.getByRole('button', { name: /Sol Ring copy/i }));

  expect(screen.getByText(/10 recorded relevant-game outcomes for this copy/i)).toBeTruthy();
  expect(screen.getByText(/Last reviewed 2026-10-13/i)).toBeTruthy();
  expect(screen.getByText(/Not a full record of all games/i)).toBeTruthy();
});

test('owner resolves duplicate physical copies before saving a new cube version', () => {
  const project = store();
  const original = 'name,Set,Collector Number\nSol Ring,C21,263\nSol Ring,C21,263';
  const first = project.importCubeCsv(original, { cubeId: 'my-cube' }).cube.entries;
  render(<App store={project} />);
  fireEvent.change(screen.getByLabelText('Cube ID'), { target: { value: 'my-cube' } });
  fireEvent.change(screen.getByLabelText('Cube Cobra CSV'), { target: { value: original } });
  fireEvent.click(screen.getByRole('button', { name: 'Import cube' }));

  expect(screen.getByText(/CSV row 2/i)).toBeTruthy();
  expect(project.getState().cubes[0].versions).toHaveLength(1);
  fireEvent.change(screen.getByLabelText(/Match CSV row 2/i), { target: { value: first[0].copyId } });
  fireEvent.change(screen.getByLabelText(/Match CSV row 3/i), { target: { value: first[1].copyId } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reconciled version' }));

  expect(project.getState().cubes[0].versions).toHaveLength(2);
  expect(project.getState().cubes[0].versions[1].entries.map((entry) => entry.copyId)).toEqual(first.map((entry) => entry.copyId));
});

test('owner chooses whether a changed printing is the same physical copy', () => {
  const project = store();
  const oldCopy = project.importCubeCsv('name,Set,Collector Number\nSol Ring,C21,263', { cubeId: 'my-cube' }).cube.entries[0];
  render(<App store={project} />);
  fireEvent.change(screen.getByLabelText('Cube ID'), { target: { value: 'my-cube' } });
  fireEvent.change(screen.getByLabelText('Cube Cobra CSV'), { target: { value: 'name,Set,Collector Number\nSol Ring,2XM,270' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import cube' }));

  expect(screen.getByRole('heading', { name: 'Review physical copy changes' })).toBeTruthy();
  expect(project.getState().cubes[0].versions).toHaveLength(1);
  fireEvent.change(screen.getByLabelText(/Match CSV row 2/i), { target: { value: oldCopy.copyId } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reconciled version' }));
  expect(project.getState().cubes[0].versions[1].entries[0].copyId).toBe(oldCopy.copyId);
});
