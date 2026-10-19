/** Flat README badges ("records | 42") in the shields.io style, without a font dependency. */
import { escapeXml } from './xml';

export interface Badge {
  label: string;
  message: string;
  /** shields.io colour name; see `badgeColors`. */
  color: BadgeColor;
}

export const badgeColors = {
  brightgreen: '#4c1',
  green: '#97ca00',
  yellow: '#dfb317',
  orange: '#fe7d37',
  red: '#e05d44',
  blue: '#007ec6',
  grey: '#555',
  lightgrey: '#9f9f9f',
} as const;
export type BadgeColor = keyof typeof badgeColors;

const HEIGHT = 20;
const PADDING = 5;
const FONT = 'Verdana,Geneva,DejaVu Sans,sans-serif';

/** Approximate advance widths of Verdana at 11px; `textLength` makes the renderer honour the estimate. */
const NARROW = new Set([...'iljI.,:;\'!| ']);
const SLIM = new Set([...'ftr()[]{}-"*/\\']);
const WIDE = new Set([...'mwMW@%']);
const UPPER = /[A-Z]/;

export function charWidth(ch: string): number {
  if (NARROW.has(ch)) return 3.8;
  if (SLIM.has(ch)) return 4.5;
  if (WIDE.has(ch)) return 10;
  if (UPPER.test(ch)) return 8;
  if (/\d/.test(ch)) return 7;
  if (/[^\x00-\x7f]/.test(ch)) return 8;
  return 6.8;
}

/** Estimated width of `text` in px, at the badge's font size. */
export function textWidth(text: string): number {
  return Math.round([...text].reduce((w, ch) => w + charWidth(ch), 0) * 10) / 10;
}

/** Flat badge SVG, laid out like shields.io's (text is drawn at 10x and scaled down so widths round cleanly). */
export function badgeSvg({ label, message, color }: Badge): string {
  const lw = textWidth(label);
  const mw = textWidth(message);
  const left = Math.round(lw + 2 * PADDING);
  const right = Math.round(mw + 2 * PADDING);
  const width = left + right;
  const title = escapeXml(`${label}: ${message}`);
  const text = (x: number, len: number, value: string) =>
    `<text aria-hidden="true" x="${x * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${len * 10}">${value}</text>` +
    `<text x="${x * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${len * 10}">${value}</text>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" role="img" aria-label="${title}">` +
    `<title>${title}</title>` +
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>` +
    `<clipPath id="r"><rect width="${width}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>` +
    `<g clip-path="url(#r)"><rect width="${left}" height="${HEIGHT}" fill="#555"/><rect x="${left}" width="${right}" height="${HEIGHT}" fill="${badgeColors[color]}"/><rect width="${width}" height="${HEIGHT}" fill="url(#s)"/></g>` +
    `<g fill="#fff" text-anchor="middle" font-family="${FONT}" text-rendering="geometricPrecision" font-size="110">` +
    text(left / 2, lw, escapeXml(label)) +
    text(left + right / 2, mw, escapeXml(message)) +
    `</g></svg>\n`
  );
}

/** shields.io "endpoint" JSON, for `https://img.shields.io/endpoint?url=…`. */
export const badgeJson = ({ label, message, color }: Badge) => ({ schemaVersion: 1, label, message, color });
