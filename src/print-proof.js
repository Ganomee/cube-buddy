import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';

const CARD_WIDTH = 63.5;
const CARD_HEIGHT = 88.9;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const START_X = (PAGE_WIDTH - CARD_WIDTH * 3) / 2;
const START_Y = (PAGE_HEIGHT - CARD_HEIGHT * 3) / 2;
const TEMPLATE_PATH = new URL('./cardback nice.png', import.meta.url);
const POSITION_TEMPLATE_PATH = new URL('./cardback overlay.svg', import.meta.url);
const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 1536;

let templateDataUrl;
let positionTemplate;
let cardbackLayout;

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

function round(value) {
  return Number(value.toFixed(3));
}

export function parseCardbackPositionTemplate(svg) {
  const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!viewBox) throw new Error('Position template needs a 0 0 width height viewBox');
  const sourceWidth = Number(viewBox[1]);
  const sourceHeight = Number(viewBox[2]);
  const layout = {};
  for (const match of svg.matchAll(/<rect\s+([^>]*data-placeholder="[^"]+"[^>]*)\/>/g)) {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
    layout[attributes['data-placeholder']] = Object.freeze({
      x: round(Number(attributes.x) * CARD_WIDTH / sourceWidth),
      y: round(Number(attributes.y) * CARD_HEIGHT / sourceHeight),
      width: round(Number(attributes.width) * CARD_WIDTH / sourceWidth),
      height: round(Number(attributes.height) * CARD_HEIGHT / sourceHeight),
    });
  }
  return Object.freeze(layout);
}

async function loadPositionTemplate() {
  if (!positionTemplate) positionTemplate = readFile(POSITION_TEMPLATE_PATH, 'utf8');
  return positionTemplate;
}

async function loadCardbackLayout() {
  if (!cardbackLayout) cardbackLayout = loadPositionTemplate().then(parseCardbackPositionTemplate);
  return cardbackLayout;
}

function countGrid(field, box) {
  const cellWidth = box.width / 10;
  const cellHeight = box.height / 5;
  const coverY = field === 'games' ? box.y - 0.15 : box.y - 1.65;
  const coverHeight = field === 'games' ? box.height + 0.15 : box.height + 3.5;
  return `<g data-field="${field}"><rect x="${box.x - 0.5}" y="${coverY}" width="${box.width + 1}" height="${coverHeight}" fill="white" stroke="none"/>${Array.from({ length: 50 }, (_, index) => {
    const col = index % 10;
    const row = Math.floor(index / 10);
    return `<rect data-mark="${field}" x="${(box.x + col * cellWidth).toFixed(2)}" y="${(box.y + row * cellHeight).toFixed(2)}" width="${cellWidth.toFixed(2)}" height="${cellHeight.toFixed(2)}" fill="white" stroke="#111" stroke-width="0.18"/>`;
  }).join('')}</g>`;
}

function pickRows(layout) {
  return [layout['picks-avg'], layout['picks-count']].map((box, row) => {
    const cellWidth = box.width / 10;
    return `<g data-pick-row="${row + 1}"><rect x="${box.x - 0.05}" y="${box.y - 0.08}" width="${box.width + 0.1}" height="${box.height + 0.17}" fill="white" stroke="#111" stroke-width="0.18"/>${Array.from({ length: 10 }, (_, column) => `<rect data-pick-box="${row * 10 + column + 1}" x="${(box.x + column * cellWidth).toFixed(3)}" y="${box.y}" width="${cellWidth.toFixed(3)}" height="${box.height}" fill="white" stroke="#111" stroke-width="0.16"/>`).join('')}</g>`;
  }).join('');
}

function qrBorders(layout) {
  const { games, qr, wins } = layout;
  const gamesBottom = games.y + games.height;
  const qrRight = qr.x + qr.width;
  const gridRight = games.x + games.width;
  return `<g data-qr-frame="notched"><line x1="${qr.x - 1.3}" y1="${gamesBottom}" x2="${qrRight + 1.3}" y2="${gamesBottom}" stroke="white" stroke-width="0.55"/><path data-qr-border="top" d="M${games.x} ${gamesBottom} H${qr.x - 1.15} L${qr.x} ${gamesBottom + 1.15} H${qrRight} L${qrRight + 1.15} ${gamesBottom} H${gridRight}" fill="none" stroke="#111" stroke-width="0.2"/><line x1="${qr.x - 1.3}" y1="${wins.y}" x2="${qrRight + 1.3}" y2="${wins.y}" stroke="white" stroke-width="0.55"/><path data-qr-border="bottom" d="M${wins.x} ${wins.y} H${qr.x - 1.15} L${qr.x} ${wins.y - 1.15} H${qrRight} L${qrRight + 1.15} ${wins.y} H${wins.x + wins.width}" fill="none" stroke="#111" stroke-width="0.2"/></g>`;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function cardbackTemplateContent({ templateHref } = {}) {
  const template = templateHref ? null : await loadTemplateDataUrl();
  return templateHref
    ? `<use data-cardback-template="cardback nice.png" data-source-size="1024x1536" href="${templateHref}"/>`
    : `<image data-cardback-template="cardback nice.png" data-source-size="1024x1536" x="0" y="0" width="63.5" height="88.9" preserveAspectRatio="none" href="${template}"/>`;
}

async function trackingOverlayContent({ copyId, name }) {
  if (typeof copyId !== 'string' || !copyId.trim()) throw new TypeError('A copyId is required');
  const payload = `cube-buddy:copy:${copyId}`;
  const qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'Q', margin: 2, width: 512, color: { dark: '#000000', light: '#ffffff' } });
  const cardName = String(name ?? '');
  const layout = await loadCardbackLayout();
  const { qr: qrBox, name: nameBox, 'copy-number': copyBox } = layout;
  const availableNameWidth = round(nameBox.width - 1.4);
  const nameFontSize = Math.max(1.65, Math.min(2.75, (availableNameWidth - 1.2) / Math.max(cardName.length, 1)));
  const forceNameWidth = cardName.length > 40 ? ` textLength="${availableNameWidth}" lengthAdjust="spacingAndGlyphs"` : '';
  const trackingFields = `${pickRows(layout)}${countGrid('games', layout.games)}${countGrid('wins', layout.wins)}${qrBorders(layout)}`;
  const copyNumber = copyId.replaceAll('-', '').slice(-9).padStart(9, '0');
  const copyX = round(copyBox.x + copyBox.width / 2);
  const copyY = Number((copyBox.y + copyBox.height * 0.72).toFixed(1));
  const nameX = round(nameBox.x + nameBox.width / 2);
  const nameY = round(nameBox.y + nameBox.height * 0.633);
  return `<g data-tracking-overlay="replacement" data-layout-source="cardback overlay.svg"><title>${escapeXml(payload)}</title>${trackingFields}<image data-placeholder="qr" x="${qrBox.x}" y="${qrBox.y}" width="${qrBox.width}" height="${qrBox.height}" href="${qr}"/><text data-copy-number="${escapeXml(copyNumber)}" x="${copyX}" y="${copyY}" font-family="Arial, sans-serif" font-size="1.15" text-anchor="middle">${escapeXml(copyNumber)}</text><rect data-placeholder="name" x="${nameBox.x}" y="${nameBox.y}" width="${nameBox.width}" height="${nameBox.height}" fill="none" stroke="none"/><text x="${nameX}" y="${nameY}" font-family="Georgia, serif" font-size="${nameFontSize.toFixed(2)}" font-weight="bold" text-anchor="middle"${forceNameWidth}>${escapeXml(cardName)}</text></g>`;
}

async function trackingBackContent(copy, options = {}) {
  const [template, overlay] = await Promise.all([
    cardbackTemplateContent(options),
    trackingOverlayContent(copy),
  ]);
  return `${template}${overlay}`;
}

export async function renderCardbackTemplate() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="63.5mm" height="88.9mm" viewBox="0 0 63.5 88.9">${await cardbackTemplateContent()}</svg>`;
}

export async function renderCardbackPositionTemplate() {
  return loadPositionTemplate();
}

export async function renderTrackingOverlay(copy) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="63.5mm" height="88.9mm" viewBox="0 0 63.5 88.9">${await trackingOverlayContent(copy)}</svg>`;
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
    backs.push(`<g transform="translate(${backX} ${y})">${await trackingBackContent(copy, { templateHref: `#${templateId}` })}</g>`);
  }
  return { frontSvg: pageSvg(fronts.join('')), backSvg: pageSvg(backs.join(''), templateDefinition), manifest };
}
