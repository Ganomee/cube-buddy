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
