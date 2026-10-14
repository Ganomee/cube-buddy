import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchCubeCobraCsv } from '../src/cube-cobra-client.js';
import { createPrintProject } from '../src/print-project.js';
import { createCubeBuddyImageResolver, renderProxxiedPdf } from '../src/proxxied-pdf.js';
import { createProjectStore } from '../src/project-store.js';
import { REFERENCE_CUBES } from '../src/reference-cubes.js';

const settingsPath = process.argv[2] || 'print-settings.json';
const printSettings = JSON.parse(await readFile(settingsPath, 'utf8'));
const reference = REFERENCE_CUBES.primary;
const downloaded = await fetchCubeCobraCsv(reference.url);
let stored = null;
const store = createProjectStore({
  getItem: () => stored,
  setItem: (_key, value) => { stored = value; },
});
const imported = store.importCubeCsv(downloaded.csv, { cubeId: downloaded.cubeId });
if (imported.review.length) throw new Error(`${imported.review.length} imported rows need review before printing`);

const project = createPrintProject(imported.cube.entries, { printSettings });
const dpi = Number(process.env.CUBE_BUDDY_PDF_DPI || 600);
const imageResolver = createCubeBuddyImageResolver();
const artworkCount = await imageResolver.prefetch(imported.cube.entries);
console.log(`Prepared ${artworkCount} WebP artwork files; rendering ${project.pages.length} PDF pages at ${dpi} DPI.`);
const pdf = await renderProxxiedPdf(project, {
  dpi,
  resolveCardImage: imageResolver,
});
const manifest = {
  format: 'cube-buddy-print-project',
  version: 1,
  generatedAt: new Date().toISOString(),
  cubeId: downloaded.cubeId,
  cubeName: downloaded.name,
  dpi,
  engine: project.engine,
  printSettings: project.printSettings,
  summary: project.summary,
  pages: project.pages.map((page, pageIndex) => ({
    page: pageIndex + 1,
    section: page.section,
    kind: page.kind,
    slots: page.cards.map((entry, slot) => entry ? { slot, copyId: entry.copyId, name: entry.name } : null),
  })),
};

await mkdir('print-output', { recursive: true });
await Promise.all([
  writeFile('print-output/cube-buddy-reference.pdf', pdf),
  writeFile('print-output/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile('print-output/cube-buddy-backup.json', store.exportBackup({ exportedAt: new Date().toISOString() })),
]);
console.log(JSON.stringify({
  pdf: 'print-output/cube-buddy-reference.pdf',
  pages: project.pages.length,
  trackedCards: project.summary.trackedCards,
  playableDoubleFacedCards: project.summary.playableDoubleFacedCards,
  dpi,
}, null, 2));
