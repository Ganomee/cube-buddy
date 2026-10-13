import { parseRecordShareToken } from './cube-cobra-connection.js';

const CONTRIBUTION_PATH = /^\/cube\/records\/contribute\/([0-9a-f-]+)$/i;

function parseContributionUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['cubecobra.com', 'www.cubecobra.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('The contribution link must come from Cube Cobra');
  }
  const match = url.pathname.match(CONTRIBUTION_PATH);
  if (!match) throw new Error('Use a Cube Cobra record contribution link');
  return { url, recordId: match[1], token: parseRecordShareToken(value) };
}

function parseReactProps(html) {
  const marker = 'window.reactProps = ';
  const start = html.indexOf(marker);
  const end = start < 0 ? -1 : html.indexOf(';</script>', start);
  if (start < 0 || end < 0) throw new Error('Cube Cobra response did not contain record data');
  return JSON.parse(html.slice(start + marker.length, end).replace(/:undefined(?=[,}])/g, ':null'));
}

function recordUrl(shareUrl, recordId) {
  return `${shareUrl.origin}/cube/record/${recordId}`;
}

function flattenCardIndexes(value, result = []) {
  if (Array.isArray(value)) value.forEach((item) => flattenCardIndexes(item, result));
  else if (Number.isSafeInteger(value)) result.push(value);
  return result;
}

function playerResult(record, playerName) {
  if (record.overrides?.[playerName]) return record.overrides[playerName];
  const result = { wins: 0, losses: 0, draws: 0 };
  for (const round of record.matches ?? []) {
    for (const match of round.matches ?? []) {
      const side = match.p1 === playerName ? 0 : match.p2 === playerName ? 1 : -1;
      if (side < 0) continue;
      const mine = match.results[side];
      const theirs = match.results[side ? 0 : 1];
      if (mine > theirs) result.wins += 1;
      else if (mine < theirs) result.losses += 1;
      else result.draws += 1;
    }
  }
  return result;
}

export async function readCubeCobraRecord(value, { fetcher = globalThis.fetch } = {}) {
  const { url: shareUrl, recordId } = parseContributionUrl(value);
  const response = await fetcher(recordUrl(shareUrl, recordId));
  if (!response.ok) throw new Error(`Cube Cobra record request failed (${response.status})`);
  const props = parseReactProps(await response.text());
  const contributions = (props.record.players ?? []).map((player, index) => {
    const seat = props.draft?.seats?.[index];
    const oracleIds = flattenCardIndexes(seat?.mainboard).map((cardIndex) => props.draft?.cards?.[cardIndex]?.details?.oracle_id).filter(Boolean);
    return { playerName: player.name, oracleIds: [...new Set(oracleIds)], ...playerResult(props.record, player.name) };
  });
  return { recordId, cubeId: props.record.cube, record: props.record, contributions };
}

export async function verifyCubeCobraRecordShare(value, { fetcher = globalThis.fetch } = {}) {
  const { url, recordId } = parseContributionUrl(value);

  const response = await fetcher(url, { method: 'GET', redirect: 'follow' });
  const finalUrl = new URL(response.url || url);
  return {
    recordId,
    valid: response.ok && finalUrl.pathname === url.pathname,
    status: response.status,
  };
}

export async function submitCubeCobraRecordContribution(value, contribution, { fetcher = globalThis.fetch } = {}) {
  const { url: shareUrl, recordId, token } = parseContributionUrl(value);
  if (!contribution?.playerName || !Array.isArray(contribution.oracleIds) || contribution.oracleIds.length === 0 ||
      ![contribution.wins, contribution.losses, contribution.draws ?? 0].every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new Error('Contribution needs a player, at least one card, and non-negative whole-number results');
  }
  const before = await readCubeCobraRecord(value, { fetcher });
  const existingIndex = before.record.players.findIndex((player) => player.name === contribution.playerName);
  const body = new URLSearchParams({
    _csrf: '',
    nickname: 'Your Nickname',
    token,
    userIndex: String(existingIndex < 0 ? -1 : existingIndex + 1),
    newPlayer: existingIndex < 0 ? contribution.playerName : '',
    mainboard: JSON.stringify(contribution.oracleIds),
    sideboard: '[]',
    wins: String(contribution.wins),
    losses: String(contribution.losses),
    draws: String(contribution.draws ?? 0),
  });
  const response = await fetcher(`${shareUrl.origin}${shareUrl.pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'follow',
  });
  if (!response.ok || new URL(response.url).pathname !== `/cube/record/${recordId}`) {
    throw new Error(`Cube Cobra contribution failed (${response.status})`);
  }
  const after = await readCubeCobraRecord(value, { fetcher });
  const saved = after.contributions.find((item) => item.playerName === contribution.playerName);
  if (!saved) throw new Error('Cube Cobra did not return the submitted player');
  const expectedIds = [...new Set(contribution.oracleIds)].sort();
  const actualIds = [...saved.oracleIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds) || saved.wins !== contribution.wins || saved.losses !== contribution.losses || saved.draws !== (contribution.draws ?? 0)) {
    throw new Error('Cube Cobra returned different deck or result data after submission');
  }
  return { recordId: after.recordId, playerName: saved.playerName, record: { wins: saved.wins, losses: saved.losses, draws: saved.draws }, oracleIds: actualIds };
}
