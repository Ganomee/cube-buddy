import { jsPDF } from 'jspdf';
import sharp from 'sharp';
import { renderTrackingBack } from './print-proof.js';

const MM_PER_INCH = 25.4;
const CARD_WIDTH_MM = 63.5;
const CARD_HEIGHT_MM = 88.9;

function pixels(valueInches, dpi) {
  return Math.round(valueInches * dpi);
}

function mmPixels(valueMm, dpi) {
  return pixels(valueMm / MM_PER_INCH, dpi);
}

export async function normalizeArtworkForProxxied(bytes, contentType = '') {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new TypeError('Artwork bytes are required');
  const input = Buffer.from(bytes);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Artwork has no readable dimensions');
  if (contentType && !contentType.toLowerCase().startsWith('image/')) throw new Error(`Artwork response is not an image (${contentType})`);
  return sharp(input).png().toBuffer();
}

export async function fetchArtworkForProxxied(url, { fetcher = globalThis.fetch } = {}) {
  if (typeof url !== 'string' || !url) throw new TypeError('Artwork URL is required');
  const response = await fetcher(url, { headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' } });
  if (!response?.ok) throw new Error(`Artwork download failed (${response?.status ?? 'network error'}): ${url}`);
  return normalizeArtworkForProxxied(Buffer.from(await response.arrayBuffer()), response.headers?.get?.('content-type') ?? '');
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function renderDoubleFacedPlaceholder(entry, fetcher) {
  const [front, back] = await Promise.all([
    fetchArtworkForProxxied(entry.artwork.frontUrl, { fetcher }),
    fetchArtworkForProxxied(entry.artwork.backUrl, { fetcher }),
  ]);
  const panelWidth = 280;
  const panelHeight = 390;
  const [frontPanel, backPanel] = await Promise.all([
    sharp(front).resize(panelWidth, panelHeight, { fit: 'cover' }).png().toBuffer(),
    sharp(back).resize(panelWidth, panelHeight, { fit: 'cover' }).png().toBuffer(),
  ]);
  const label = Buffer.from(`<svg width="635" height="889" xmlns="http://www.w3.org/2000/svg"><rect width="635" height="889" fill="white"/><rect x="18" y="18" width="599" height="853" rx="24" fill="none" stroke="black" stroke-width="6"/><text x="317.5" y="70" font-family="serif" font-size="30" font-weight="bold" text-anchor="middle">${escapeXml(entry.name)}</text><text x="317.5" y="830" font-family="sans-serif" font-size="22" text-anchor="middle">Double-faced card · use playable copy from side pile</text></svg>`);
  return sharp(label).composite([
    { input: frontPanel, left: 28, top: 105 },
    { input: backPanel, left: 327, top: 105 },
  ]).png().toBuffer();
}

export function createCubeBuddyImageResolver({ fetcher = globalThis.fetch } = {}) {
  const artworkCache = new Map();
  const artwork = (url) => {
    if (!artworkCache.has(url)) artworkCache.set(url, fetchArtworkForProxxied(url, { fetcher }));
    return artworkCache.get(url);
  };
  const resolver = async (entry, page) => {
    if (page.kind === 'tracking-back') {
      return sharp(Buffer.from(await renderTrackingBack(entry))).png().toBuffer();
    }
    if (page.kind === 'dfc-back') return artwork(entry.artwork.backUrl);
    if (page.kind === 'dfc-front') return artwork(entry.artwork.frontUrl);
    if (page.kind === 'tracked-front' && entry.artwork?.backUrl) {
      const cachedFetcher = async (url) => ({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => artwork(url).then((buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
      });
      return renderDoubleFacedPlaceholder(entry, cachedFetcher);
    }
    return artwork(entry.artwork?.frontUrl);
  };
  resolver.prefetch = async (entries, { concurrency = 12 } = {}) => {
    const urls = [...new Set(entries.flatMap((entry) => [entry.artwork?.frontUrl, entry.artwork?.backUrl]).filter(Boolean))];
    let next = 0;
    async function worker() {
      while (next < urls.length) await artwork(urls[next++]);
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
    return urls.length;
  };
  return resolver;
}

async function renderPage(page, settings, { dpi, resolveCardImage }) {
  const pageWidth = pixels(settings.pageWidthInches, dpi);
  const pageHeight = pixels(settings.pageHeightInches, dpi);
  const contentWidth = mmPixels(CARD_WIDTH_MM, dpi);
  const contentHeight = mmPixels(CARD_HEIGHT_MM, dpi);
  const bleed = settings.bleedEdge ? mmPixels(settings.bleedEdgeWidthMm, dpi) : 0;
  const cardWidth = contentWidth + bleed * 2;
  const cardHeight = contentHeight + bleed * 2;
  const startX = Math.round((pageWidth - settings.cols * cardWidth) / 2);
  const startY = Math.round((pageHeight - settings.rows * cardHeight) / 2);
  if (startX < 0 || startY < 0) throw new Error('Proxxied print settings do not fit the card grid on the page');

  const composites = [];
  for (let index = 0; index < page.cards.length; index++) {
    const card = page.cards[index];
    if (!card) continue;
    const normalized = await normalizeArtworkForProxxied(await resolveCardImage(card, page));
    const image = await sharp(normalized)
      .resize(contentWidth, contentHeight, { fit: 'cover' })
      .extend({ top: bleed, bottom: bleed, left: bleed, right: bleed, background: '#000000' })
      .png().toBuffer();
    composites.push({
      input: image,
      left: startX + (index % settings.cols) * cardWidth,
      top: startY + Math.floor(index / settings.cols) * cardHeight,
    });
  }
  return sharp({
    create: { width: pageWidth, height: pageHeight, channels: 4, background: settings.pdfPageColor },
  }).composite(composites).flatten({ background: settings.pdfPageColor }).jpeg({ quality: 95 }).toBuffer();
}

export async function renderProxxiedPdf(project, {
  dpi = 600,
  resolveCardImage = createCubeBuddyImageResolver(),
} = {}) {
  if (!project?.printSettings || !Array.isArray(project.pages) || project.pages.length === 0) {
    throw new TypeError('A prepared print project with pages is required');
  }
  if (!Number.isFinite(dpi) || dpi <= 0) throw new TypeError('A positive PDF DPI is required');
  const settings = project.printSettings;
  const widthMm = settings.pageWidthInches * MM_PER_INCH;
  const heightMm = settings.pageHeightInches * MM_PER_INCH;
  const pdf = new jsPDF({
    orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    unit: 'mm', format: [widthMm, heightMm], compress: true,
  });
  for (let index = 0; index < project.pages.length; index++) {
    const page = await renderPage(project.pages[index], settings, { dpi, resolveCardImage });
    if (index > 0) pdf.addPage([widthMm, heightMm], widthMm >= heightMm ? 'landscape' : 'portrait');
    pdf.addImage(new Uint8Array(page), 'JPEG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
