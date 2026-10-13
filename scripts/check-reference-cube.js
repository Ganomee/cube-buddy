import { fetchCubeCobraCsv } from '../src/cube-cobra-client.js';
import { importCubeCobraCsv } from '../src/cube-cobra-import.js';
import { REFERENCE_CUBES } from '../src/reference-cubes.js';

const reference = REFERENCE_CUBES.primary;
const downloaded = await fetchCubeCobraCsv(reference.url);
const imported = importCubeCobraCsv(downloaded.csv, { cubeId: downloaded.cubeId, versionId: 'live-check' });
const boards = Object.groupBy(imported.cube.entries, (entry) => entry.board);
const missingNames = imported.cube.entries.filter((entry) => !entry.name);
const missingArt = imported.cube.entries.filter((entry) => !entry.artwork.frontUrl);

if (downloaded.name !== reference.expectedName) throw new Error(`Expected ${reference.expectedName}, received ${downloaded.name}`);
if (imported.cube.entries.length < 300) throw new Error(`Expected at least 300 entries, received ${imported.cube.entries.length}`);
if (missingNames.length) throw new Error(`${missingNames.length} entries have no name`);

console.log(JSON.stringify({
  cubeId: downloaded.cubeId,
  name: downloaded.name,
  entries: imported.cube.entries.length,
  boards: Object.fromEntries(Object.entries(boards).map(([board, entries]) => [board, entries.length])),
  selectedArtworkUrls: imported.cube.entries.length - missingArt.length,
  missingArtworkUrls: missingArt.length,
  reviewItems: imported.review.length,
}, null, 2));
