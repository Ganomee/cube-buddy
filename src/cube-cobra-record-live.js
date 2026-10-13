import { parseRecordShareToken } from './cube-cobra-connection.js';

const CONTRIBUTION_PATH = /^\/cube\/records\/contribute\/([0-9a-f-]+)$/i;

export async function verifyCubeCobraRecordShare(value, { fetcher = globalThis.fetch } = {}) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['cubecobra.com', 'www.cubecobra.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('The contribution link must come from Cube Cobra');
  }
  const match = url.pathname.match(CONTRIBUTION_PATH);
  if (!match) throw new Error('Use a Cube Cobra record contribution link');
  parseRecordShareToken(value);

  const response = await fetcher(url, { method: 'GET', redirect: 'follow' });
  const finalUrl = new URL(response.url || url);
  return {
    recordId: match[1],
    valid: response.ok && finalUrl.pathname === url.pathname,
    status: response.status,
  };
}
