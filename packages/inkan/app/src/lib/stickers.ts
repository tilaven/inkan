import { escapeXml } from './xml';

const TAU = Math.PI * 2;
const f = (n: number) => n.toFixed(2);

function rosette(n: number, R: number, a: number) {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * TAU;
    const r = R * (1 + a * 0.022 * Math.cos(n * t) * 2.1);
    d += `${i ? 'L' : 'M'}${f(36 + r * Math.cos(t - Math.PI / 2))} ${f(36 + r * Math.sin(t - Math.PI / 2))}`;
  }
  return `${d}Z`;
}

function star(n: number, R: number, r: number) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${f(36 + rr * Math.cos(t))} ${f(36 + rr * Math.sin(t))}`;
  }
  return `${d}Z`;
}

function poly(n: number, R: number, rot: number) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = rot + (i / n) * TAU;
    d += `${i ? 'L' : 'M'}${f(36 + R * Math.cos(t))} ${f(36 + R * Math.sin(t))}`;
  }
  return `${d}Z`;
}

/** Die-cut silhouettes in a 72×72 box. `superseded` has a second, overprinted plate. */
export const SILHOUETTES: Record<string, string> = {
  draft: 'M23 9H49a14 14 0 0 1 14 14V49a14 14 0 0 1-14 14H23A14 14 0 0 1 9 49V23A14 14 0 0 1 23 9Z',
  proposed: 'M9 22a6 6 0 0 1 6-6H45L65 36 45 56H15a6 6 0 0 1-6-6Z',
  'in-review': 'M36 8a28 28 0 1 1 0 56a28 28 0 1 1 0-56Z',
  accepted: rosette(12, 29, 1),
  implemented: star(10, 31, 22),
  rejected: poly(8, 30, Math.PI / 8),
  withdrawn:
    'M15 17H57a6 6 0 0 1 6 6V30a6 6 0 0 0 0 12V49a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V42a6 6 0 0 0 0-12V23a6 6 0 0 1 6-6Z',
  deprecated: poly(6, 30, -Math.PI / 2),
  superseded: 'M17 8H39a9 9 0 0 1 9 9V39a9 9 0 0 1-9 9H17a9 9 0 0 1-9-9V17a9 9 0 0 1 9-9Z',
  'superseded-front': 'M33 24H55a9 9 0 0 1 9 9V55a9 9 0 0 1-9 9H33a9 9 0 0 1-9-9V33a9 9 0 0 1 9-9Z',
};

export const GLYPHS: Record<string, string> = {
  draft: '<g fill="currentColor"><circle cx="24" cy="36" r="3.6"/><circle cx="36" cy="36" r="3.6"/><circle cx="48" cy="36" r="3.6"/></g>',
  proposed: '<path d="M26 46 46 26M29 26h17v17" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  'in-review': '<g fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round"><circle cx="33" cy="32" r="10"/><path d="M41 40l9 9"/></g>',
  accepted: '<path d="M23 37l9 9 17-20" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  implemented: '<path d="M20 37l7 7 12-14M31 44l3 3 16-19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  rejected: '<path d="M26 26l20 20M46 26L26 46" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
  withdrawn: '<g fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M31 27l-7 7 7 7"/><path d="M24 34h20a7 7 0 0 1 0 14H34"/></g>',
  deprecated: '<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M36 22v15"/><path d="M36 47v.2"/></g>',
  superseded: '<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M33 43h20"/><path d="M47 36l7 7-7 7"/></g>',
};

export const BUILT_IN_STICKERS = Object.keys(GLYPHS);

/** Built-in sticker for a status: its own, the one named in config (`sticker`), or null for the fallback. */
export function stickerFor(status: string, configured?: string): string | null {
  if (configured && configured in GLYPHS) return configured;
  return status in GLYPHS ? status : null;
}

/** Glyph markup for a sticker; unknown statuses get their first letter. */
export function glyphFor(sticker: string | null, label: string) {
  if (sticker) return GLYPHS[sticker];
  const letter = escapeXml((label.trim()[0] ?? '?').toUpperCase());
  return `<text x="36" y="37" text-anchor="middle" dominant-baseline="central" font-family="var(--inkan-font-display)" font-weight="800" font-size="30" fill="currentColor">${letter}</text>`;
}

const dataUri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const mask = (d: string, stroke = '') =>
  dataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><path d="${d}" fill="#000"${stroke}/></svg>`);

/** `:root` custom properties with the silhouette masks the sticker CSS reads. */
export function stickerMaskCss() {
  const vars = Object.entries(SILHOUETTES).flatMap(([id, d]) => [
    `--stk-${id}:${mask(d)}`,
    `--stk-out-${id}:${mask(d, ' stroke="#000" stroke-width="9" stroke-linejoin="round"')}`,
  ]);
  return `:root{${vars.join(';')}}`;
}

const FILLS: Record<string, string> = {
  draft: '#E7EBF3',
  proposed: '#00AEEF',
  'in-review': '#FFE000',
  rejected: '#FF3B1F',
  withdrawn: '#9AA5BC',
  deprecated: '#E9B245',
  superseded: '#00AEEF',
};
const FOILS: Record<string, string> = {
  accepted: '<stop offset="0" stop-color="#5AE8FF"/><stop offset=".25" stop-color="#B58CFF"/><stop offset=".5" stop-color="#FF7ED3"/><stop offset=".75" stop-color="#FFD66B"/><stop offset="1" stop-color="#9BFFB4"/>',
  implemented: '<stop offset="0" stop-color="#FFE9A6"/><stop offset=".3" stop-color="#FFB74D"/><stop offset=".55" stop-color="#FFF3C7"/><stop offset=".8" stop-color="#F2A93B"/><stop offset="1" stop-color="#FFE08A"/>',
};

/**
 * A sticker as a self-contained SVG document (72×72), for prints outside the page such as Open Graph cards.
 * Foil statuses get a static gradient in place of the page's animated sheen.
 */
export function stickerSvg(
  status: string,
  { label = status, sticker = stickerFor(status), color, glyph = true }: { label?: string; sticker?: string | null; color?: string; glyph?: boolean } = {},
) {
  const shape = sticker ?? 'draft';
  const cut = (d: string) => `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>`;
  const foil = sticker ? FOILS[sticker] : undefined;
  const fill = foil ? 'url(#foil)' : sticker ? FILLS[sticker] : escapeXml(color ?? '#C9D0DD');
  const plates =
    shape === 'superseded'
      ? `${cut(SILHOUETTES.superseded)}${cut(SILHOUETTES['superseded-front'])}<path d="${SILHOUETTES.superseded}" fill="#00AEEF"/><path d="${SILHOUETTES['superseded-front']}" fill="#FF2D8F" style="mix-blend-mode:multiply"/>`
      : `${cut(SILHOUETTES[shape])}<path d="${SILHOUETTES[shape]}" fill="${fill}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 84 84" width="84" height="84">` +
    (foil ? `<defs><linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">${foil}</linearGradient></defs>` : '') +
    plates +
    (glyph ? `<g color="${sticker === 'rejected' ? '#fff' : '#0A0D17'}">${glyphFor(sticker, label).replace('var(--inkan-font-display)', 'Anybody')}</g>` : '') +
    '</svg>'
  );
}
