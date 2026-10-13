import QRCode from 'qrcode';

const CARD_WIDTH = 63.5;
const CARD_HEIGHT = 88.9;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const START_X = (PAGE_WIDTH - CARD_WIDTH * 3) / 2;
const START_Y = (PAGE_HEIGHT - CARD_HEIGHT * 3) / 2;

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function trackingBackContent({ copyId, name, cycle = 1 }) {
  if (typeof copyId !== 'string' || !copyId.trim()) throw new TypeError('A copyId is required');
  const payload = `cube-buddy:copy:${copyId}`;
  const qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 4, width: 320 });
  const edgeRows = [0, 1].map((row) => {
    const y = 2.6 + row * 5.1;
    const label = row === 0 ? 'Average pick' : 'Drafts';
    const blanks = Array.from({ length: 15 }, (_, index) => `<rect data-pick-box="${row * 15 + index + 1}" x="${18 + index * 2.9}" y="${y - 1.5}" width="2.55" height="3.8" fill="none" stroke="#666" stroke-width="0.18"/>`).join('');
    return `<text x="2.2" y="${y + 1.1}" font-size="2.3">${label}</text>${blanks}`;
  }).join('');
  const fields = ['games', 'wins'].map((field, fieldIndex) => {
    const panelX = fieldIndex === 0 ? 2 : 32.3;
    const squares = Array.from({ length: 50 }, (_, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = panelX + 1.8 + col * 5.2;
      const y = 20.3 + row * 4.55;
      return `<rect data-mark="${field}" x="${x}" y="${y}" width="3.7" height="3.7" fill="none" stroke="#333" stroke-width="0.23"/>`;
    }).join('');
    return `<g data-field="${field}"><rect x="${panelX}" y="14.2" width="29.2" height="52.5" fill="none" stroke="#222" stroke-width="0.32"/><text x="${panelX + 14.6}" y="18.4" font-size="3.3" font-weight="bold" text-anchor="middle">${field === 'games' ? 'Games' : 'Wins'}</text>${squares}</g>`;
  }).join('');
  return `<title>${escapeXml(payload)}</title><rect x="0.2" y="0.2" width="63.1" height="88.5" fill="white" stroke="#222" stroke-width="0.4"/><line x1="0.2" y1="13.2" x2="63.3" y2="13.2" stroke="#222" stroke-width="0.25"/>${edgeRows}${fields}<image x="2" y="68.4" width="18.5" height="18.5" href="${qr}"/><text x="22.5" y="73" font-size="2.5">${escapeXml(name ?? '')}</text><text x="22.5" y="78" font-size="2.2">Copy ${escapeXml(copyId.slice(-8))}</text><text x="22.5" y="83" font-size="2.2">Cycle ${escapeXml(cycle)}</text>`;
}

export async function renderTrackingBack(copy) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="63.5mm" height="88.9mm" viewBox="0 0 63.5 88.9">${await trackingBackContent(copy)}</svg>`;
}

function pageSvg(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="white"/>${content}</svg>`;
}

export async function renderA4Proof(copies) {
  if (!Array.isArray(copies) || copies.length !== 9) throw new Error('A4 proof needs nine physical copies');
  if (new Set(copies.map((copy) => copy.copyId)).size !== 9) throw new Error('A4 proof needs nine distinct physical copies');

  const fronts = [];
  const backs = [];
  const manifest = [];
  for (let index = 0; index < copies.length; index++) {
    const copy = copies[index];
    const row = Math.floor(index / 3);
    const col = index % 3;
    const backSlot = row * 3 + (2 - col);
    const frontX = START_X + col * CARD_WIDTH;
    const backX = START_X + (2 - col) * CARD_WIDTH;
    const y = START_Y + row * CARD_HEIGHT;
    manifest.push({ number: index + 1, copyId: copy.copyId, frontSlot: index, backSlot });
    fronts.push(`<g transform="translate(${frontX} ${y})"><rect width="63.5" height="88.9" fill="white" stroke="#222" stroke-width="0.25"/><text x="31.75" y="37" text-anchor="middle" font-size="20">${index + 1}</text><text x="31.75" y="47" text-anchor="middle" font-size="3.2">${escapeXml(copy.name)}</text><text x="31.75" y="53" text-anchor="middle" font-size="2.5">${escapeXml(copy.copyId.slice(-8))}</text></g>`);
    backs.push(`<g transform="translate(${backX} ${y})">${await trackingBackContent(copy)}<text x="58" y="84" font-size="3">${index + 1}</text></g>`);
  }
  return { frontSvg: pageSvg(fronts.join('')), backSvg: pageSvg(backs.join('')), manifest };
}
