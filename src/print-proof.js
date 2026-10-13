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
    const blanks = Array.from({ length: 5 }, (_, index) => `<rect x="${25.4 + index * 7.1}" y="${y - 1.5}" width="6.4" height="3.8" fill="none" stroke="#666" stroke-width="0.18"/>`).join('');
    return `<text x="2.2" y="${y + 1.1}" font-size="2.3">${label}</text>${blanks}`;
  }).join('');
  const slots = Array.from({ length: 50 }, (_, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const x = 2 + col * 11.9;
    const y = 14.2 + row * 5.25;
    return `<g data-slot="${index + 1}"><rect x="${x}" y="${y}" width="11.9" height="5.25" fill="none" stroke="#777" stroke-width="0.18"/><text x="${x + 0.6}" y="${y + 3.3}" font-size="2.4">${index + 1}</text><circle data-outcome="W" cx="${x + 6.3}" cy="${y + 2.5}" r="1.45" fill="none" stroke="#222" stroke-width="0.22"/><circle data-outcome="L" cx="${x + 9.8}" cy="${y + 2.5}" r="1.45" fill="none" stroke="#222" stroke-width="0.22"/><text x="${x + 5.55}" y="${y + 3.2}" font-size="1.8">W</text><text x="${x + 9.35}" y="${y + 3.2}" font-size="1.8">L</text></g>`;
  }).join('');
  return `<title>${escapeXml(payload)}</title><rect x="0.2" y="0.2" width="63.1" height="88.5" fill="white" stroke="#222" stroke-width="0.4"/><line x1="0.2" y1="13.2" x2="63.3" y2="13.2" stroke="#222" stroke-width="0.25"/>${edgeRows}${slots}<image x="2" y="68.4" width="18.5" height="18.5" href="${qr}"/><text x="22.5" y="73" font-size="2.5">${escapeXml(name ?? '')}</text><text x="22.5" y="78" font-size="2.2">Copy ${escapeXml(copyId.slice(-8))}</text><text x="22.5" y="83" font-size="2.2">Cycle ${escapeXml(cycle)}</text>`;
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
