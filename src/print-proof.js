import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';

const CARD_WIDTH = 63.5;
const CARD_HEIGHT = 88.9;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const START_X = (PAGE_WIDTH - CARD_WIDTH * 3) / 2;
const START_Y = (PAGE_HEIGHT - CARD_HEIGHT * 3) / 2;
const TEMPLATE_PATH = new URL('./cardback nice.png', import.meta.url);
const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 1536;

export const CARD_BACK_LAYOUT = Object.freeze({
  source: Object.freeze({ width: SOURCE_WIDTH, height: SOURCE_HEIGHT }),
  // Extracted from the grey corner guides at pixels (373, 614)-(651, 902).
  qr: Object.freeze({ x: 23.85, y: 36.1, width: 15.8, height: 15.8 }),
  // Extracted from the bottom plaque at pixels (150, 1315)-(870, 1425).
  name: Object.freeze({ x: 9.3, y: 76.1, width: 44.6, height: 6.4 }),
});

let templateDataUrl;

async function loadTemplateDataUrl() {
  if (!templateDataUrl) {
    templateDataUrl = readFile(TEMPLATE_PATH).then((png) => {
      const signature = png.subarray(1, 4).toString('ascii');
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      if (signature !== 'PNG' || width !== SOURCE_WIDTH || height !== SOURCE_HEIGHT) {
        throw new Error(`Cardback template must be a ${SOURCE_WIDTH}x${SOURCE_HEIGHT} PNG`);
      }
      return `data:image/png;base64,${png.toString('base64')}`;
    });
  }
  return templateDataUrl;
}

function countGrid(field, x, y) {
  const coverY = field === 'games' ? 15.65 : 52.7;
  const coverHeight = field === 'games' ? 18.75 : 22.1;
  return `<g data-field="${field}"><rect x="14.15" y="${coverY}" width="38.9" height="${coverHeight}" fill="white" stroke="none"/>${Array.from({ length: 50 }, (_, index) => {
    const col = index % 10;
    const row = Math.floor(index / 10);
    return `<rect data-mark="${field}" x="${(x + col * 3.72).toFixed(2)}" y="${(y + row * 3.72).toFixed(2)}" width="3.72" height="3.72" fill="white" stroke="#111" stroke-width="0.18"/>`;
  }).join('')}</g>`;
}

function pickRows() {
  return [0, 1].map((row) => {
    const y = row === 0 ? 7.52 : 11.58;
    return `<g data-pick-row="${row + 1}"><rect x="12.65" y="${y - 0.08}" width="43.7" height="3.42" fill="white" stroke="#111" stroke-width="0.18"/>${Array.from({ length: 10 }, (_, column) => `<rect data-pick-box="${row * 10 + column + 1}" x="${(12.7 + column * 4.36).toFixed(3)}" y="${y}" width="4.36" height="3.25" fill="white" stroke="#111" stroke-width="0.16"/>`).join('')}</g>`;
  }).join('');
}

function qrBorders() {
  return `<g data-qr-frame="notched"><line x1="22.55" y1="34.4" x2="40.95" y2="34.4" stroke="white" stroke-width="0.55"/><path data-qr-border="top" d="M14.65 34.4 H22.7 L23.85 35.55 H39.65 L40.8 34.4 H51.85" fill="none" stroke="#111" stroke-width="0.2"/><line x1="22.55" y1="54.35" x2="40.95" y2="54.35" stroke="white" stroke-width="0.55"/><path data-qr-border="bottom" d="M14.65 54.35 H22.7 L23.85 53.2 H39.65 L40.8 54.35 H51.85" fill="none" stroke="#111" stroke-width="0.2"/></g>`;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function trackingBackContent({ copyId, name }, { templateHref } = {}) {
  if (typeof copyId !== 'string' || !copyId.trim()) throw new TypeError('A copyId is required');
  const payload = `cube-buddy:copy:${copyId}`;
  const [qr, template] = await Promise.all([
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'Q', margin: 2, width: 512, color: { dark: '#000000', light: '#ffffff' } }),
    templateHref ? null : loadTemplateDataUrl(),
  ]);
  const cardName = String(name ?? '');
  const nameFontSize = Math.max(1.65, Math.min(2.75, 42 / Math.max(cardName.length, 1)));
  const forceNameWidth = cardName.length > 40 ? ' textLength="43.2" lengthAdjust="spacingAndGlyphs"' : '';
  const { qr: qrBox, name: nameBox } = CARD_BACK_LAYOUT;
  const trackingFields = `${pickRows()}${countGrid('games', 14.65, 15.8)}${countGrid('wins', 14.65, 54.35)}${qrBorders()}`;
  const artwork = templateHref
    ? `<use data-cardback-template="cardback nice.png" data-source-size="1024x1536" href="${templateHref}"/>`
    : `<image data-cardback-template="cardback nice.png" data-source-size="1024x1536" x="0" y="0" width="63.5" height="88.9" preserveAspectRatio="none" href="${template}"/>`;
  return `<title>${escapeXml(payload)}</title>${artwork}${trackingFields}<image data-placeholder="qr" x="${qrBox.x}" y="${qrBox.y}" width="${qrBox.width}" height="${qrBox.height}" href="${qr}"/><rect data-placeholder="name" x="${nameBox.x}" y="${nameBox.y}" width="${nameBox.width}" height="${nameBox.height}" fill="none" stroke="none"/><text x="31.6" y="79.05" font-family="Georgia, serif" font-size="${nameFontSize.toFixed(2)}" font-weight="bold" text-anchor="middle"${forceNameWidth}>${escapeXml(cardName)}</text><text x="31.6" y="81.55" font-family="Arial, sans-serif" font-size="1.55" text-anchor="middle">${escapeXml(copyId.slice(-8))}</text>`;
}

export async function renderTrackingBack(copy) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="63.5mm" height="88.9mm" viewBox="0 0 63.5 88.9">${await trackingBackContent(copy)}</svg>`;
}

function pageSvg(content, definitions = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">${definitions ? `<defs>${definitions}</defs>` : ''}<rect width="210" height="297" fill="white"/>${content}</svg>`;
}

export async function renderA4Proof(copies) {
  if (!Array.isArray(copies) || copies.length !== 9) throw new Error('A4 proof needs nine physical copies');
  if (new Set(copies.map((copy) => copy.copyId)).size !== 9) throw new Error('A4 proof needs nine distinct physical copies');

  const fronts = [];
  const backs = [];
  const manifest = [];
  const template = await loadTemplateDataUrl();
  const templateId = 'cube-buddy-cardback-template';
  const templateDefinition = `<image id="${templateId}" x="0" y="0" width="63.5" height="88.9" preserveAspectRatio="none" href="${template}"/>`;
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
    backs.push(`<g transform="translate(${backX} ${y})">${await trackingBackContent(copy, { templateHref: `#${templateId}` })}<g data-proof-number="${index + 1}" transform="translate(31.75 74.55)"><path d="M0 -1.6 L1.6 0 L0 1.6 L-1.6 0 Z" fill="white" stroke="#111" stroke-width="0.18"/><text x="0" y="0.58" text-anchor="middle" font-family="Arial, sans-serif" font-size="1.75" font-weight="bold">${index + 1}</text></g></g>`);
  }
  return { frontSvg: pageSvg(fronts.join('')), backSvg: pageSvg(backs.join(''), templateDefinition), manifest };
}
