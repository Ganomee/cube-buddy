import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixture = (name) => fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url));
const alexId = 'c0f420ee-edbc-4a58-a1a5-111111111111';
const secondAlexId = 'eb796ba1-af24-4b3d-8c5f-222222222222';
const quinnId = '70ab5dab-8914-4ce8-89eb-444444444444';

test('organizer reviews a local DraftLog, downloads the roster and reopens it', async ({ page }) => {
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  const rosterLink = page.getByRole('link', { name: 'Import Draftmancer roster' });
  await expect(rosterLink).toBeVisible();
  await rosterLink.click();
  await expect(page).toHaveURL('/draft-roster.html');
  await expect(page.getByRole('heading', { name: 'Draft roster' })).toBeVisible();
  const fileInput = page.getByLabel('Draft log or roster file');
  await fileInput.setInputFiles(fixture('draftmancer-v2.1.txt'));

  await expect(page.getByText('1 bot skipped')).toBeVisible();
  const alex = page.getByRole('group', { name: new RegExp(alexId) });
  const otherAlex = page.getByRole('group', { name: new RegExp(secondAlexId) });
  await expect(otherAlex.getByText('1 card in draft pool')).toBeVisible();
  await expect(otherAlex.getByText('No decklist in log')).toBeVisible();
  await expect(otherAlex.getByLabel('Carry over deck')).toHaveCount(0);
  await expect(alex.getByLabel('Carry over deck')).not.toBeChecked();
  await alex.getByText('View deck').click();
  await expect(alex.getByText('2 × Lightning Bolt')).toBeVisible();
  await alex.getByLabel('Carry over deck').check();
  await page.getByRole('group', { name: /Morgan/ }).getByLabel('Attending').uncheck();
  await page.getByRole('button', { name: 'Confirm roster' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed roster' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download roster' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('cube-buddy-draft-roster.json');
  const downloadedPath = await download.path();
  const roster = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(roster.format).toBe('cube-buddy-draft-roster');
  expect(roster.schemaVersion).toBe(1);
  expect(roster.players.map((player) => player.playerId)).toEqual([alexId, secondAlexId, quinnId]);
  expect(roster.players[0].deck.basicLands).toEqual({ W: 0, U: 7, B: 0, R: 8, G: 0 });
  expect(roster.players[1]).not.toHaveProperty('deck');
  expect(roster.players[2]).not.toHaveProperty('deck');

  await page.reload();
  await expect(page.getByText('3 players confirmed')).toBeVisible();
  for (let i = 0; i < 2; i += 1) {
    await fileInput.setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: await readFile(downloadedPath) });
    await expect(page.getByText('Roster file opened.')).toBeVisible();
    await expect(page.getByText('3 players confirmed')).toBeVisible();
    await expect(page.getByText('Alex', { exact: true })).toHaveCount(2);
  }
});

test('JSON logs work and a broken deck or invalid file leaves a path to export', async ({ page }) => {
  await page.goto('/draft-roster.html');
  const fileInput = page.getByLabel('Draft log or roster file');
  const log = JSON.parse(await readFile(fixture('draftmancer-v2.0.json'), 'utf8'));
  Object.values(log.users)[0].decklist.side = ['unavailable-printing'];
  await fileInput.setInputFiles({
    name: 'old-draft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(log)),
  });
  await expect(page.getByText(/sideboard.*unavailable-printing/i)).toBeVisible();
  await expect(page.getByLabel('Carry over deck')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm roster' }).click();
  await expect(page.getByText('1 player confirmed')).toBeVisible();

  await fileInput.setInputFiles({ name: 'broken.txt', mimeType: 'text/plain', buffer: Buffer.from('bad JSON') });
  await expect(page.getByRole('alert')).toContainText('valid JSON');
  await expect(page.getByRole('button', { name: 'Download roster' })).toBeEnabled();
});
