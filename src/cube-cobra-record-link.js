const ORIGIN = 'https://cubecobra.com';
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const RECORD_ID = new RegExp(`^${UUID}$`);
const RECORD_URL = new RegExp(`^https://(?:www\\.)?cubecobra\\.com/cube/record/(${UUID})/?(?:[?#][^\\s\\\\]*)?$`, 'i');
const CUBE_ID = /^[a-z0-9][a-z0-9_-]*$/i;

export function getCubeCobraRecordsLinks(cubeId) {
  if (typeof cubeId !== 'string' || !CUBE_ID.test(cubeId)) return null;
  const records = `${ORIGIN}/cube/records`;
  return { list: `${records}/${cubeId}`, create: `${records}/create/${cubeId}` };
}

export function parseCubeCobraRecordUrl(value) {
  // Match the pasted path before URL parsing can normalize dot segments or backslashes.
  const match = typeof value === 'string' && RECORD_URL.exec(value.trim());
  if (!match) throw new Error('Paste the Cube Cobra Record page URL from /cube/record/ followed by its Record ID.');
  return match[1].toLowerCase();
}

export function getCubeCobraRecordUrl(recordId) {
  if (typeof recordId !== 'string' || !RECORD_ID.test(recordId)) return null;
  return `${ORIGIN}/cube/record/${recordId}`;
}
