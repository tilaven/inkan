/**
 * Cover art, built at build time as SVG. Every record gets a riso-style print
 * derived from its id by a seeded RNG that picks the motifs and the layout,
 * drawn with ink classes (styles/cover.css) instead of colours, so one string
 * works in Day (inks multiply on paper) and Stage (lights screen on black).
 */
import { hash, rng } from './rng';
import { Canvas, circle, n } from './canvas';
import { getMotif } from './motif-registry';
import type { Ink } from './inks';

export interface CoverInput {
  id: string;
  ink: Ink;
  motif: string;
  /** Project the record belongs to: seeds the choices its covers share. */
  project?: string;
  status?: string;
}

export interface CoverOptions {
  width?: number;
  height?: number;
  /** Distinguishes the ids of several renders of the same cover on one page. */
  instance?: number;
}

export type Stock = 'paper' | 'flood' | 'black';

const STOCKS: Stock[] = ['paper', 'paper', 'paper', 'flood', 'black'];
const ALT: Record<Ink, Ink> = { c: 'm', m: 'y', y: 'c', g: 'c', v: 'm', o: 'm' };

const grayscale = (a: number) => `<feColorMatrix type="saturate" values="${n(1 - a)}"/>`;
const linear = (slope: number, intercept = 0) =>
  `<feComponentTransfer>${['R', 'G', 'B'].map((c) => `<feFunc${c} type="linear" slope="${n(slope)}" intercept="${n(intercept)}"/>`).join('')}</feComponentTransfer>`;
const contrast = (a: number) => linear(a, 0.5 - a / 2);
const sepia = (a: number) => {
  const k = 1 - a;
  const m = [
    [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k],
    [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k],
    [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k],
  ];
  return `<feColorMatrix type="matrix" values="${m.map((row) => `${row.map(n).join(' ')} 0 0`).join(' ')} 0 0 0 1 0"/>`;
};

/**
 * Treatments baked into the print for records that no longer describe the current state: the CSS filter
 * functions written as SVG primitives, so the filter region can be pinned to the card (rasterisers choke on
 * the oversized regions that framed motifs would otherwise get).
 */
const TREATMENT: Record<string, { filter: string; opacity?: number }> = {
  rejected: { filter: grayscale(1) + contrast(1.05) },
  withdrawn: { filter: grayscale(0.85), opacity: 0.5 },
  superseded: { filter: grayscale(0.7) + contrast(0.95), opacity: 0.78 },
  deprecated: { filter: sepia(0.55) + `<feColorMatrix type="saturate" values=".7"/>` + linear(1.04), opacity: 0.95 },
  draft: { filter: grayscale(0.5), opacity: 0.38 },
};

let rendered = 0;
/** Instance number for the next cover rendered in this process (keeps ids unique on a page). */
export const nextCoverInstance = () => rendered++;

/** Which card stock a record is printed on, derived from its id. */
export function coverStock(id: string): Stock {
  return STOCKS[Math.floor(rng(`v:${id}`)() * STOCKS.length)];
}

/**
 * How the print sits on the card: every record zooms into its own part of the motif at its own angle, so
 * covers that share a project's motif and ink still look different side by side.
 */
export function framing(id: string, width: number, height: number): string {
  const f = rng(`frame:${id}`);
  const scale = 1.15 + f() * 0.7;
  const angle = (f() * 2 - 1) * 18;
  const fx = width * (0.25 + f() * 0.5);
  const fy = height * (0.2 + f() * 0.45);
  return `rotate(${n(angle)} ${n(fx)} ${n(fy)}) translate(${n(fx)} ${n(fy)}) scale(${n(scale)}) translate(${n(-fx)} ${n(-fy)})`;
}

/** A flat shape in the second ink laid over the print, placed per record (none on flood stock, where it would be key). */
export function overprint(id: string, stock: Stock, width: number, height: number): string {
  if (stock === 'flood') return '';
  const f = rng(`over:${id}`);
  const x = width * (f() * 1.1 - 0.05);
  const y = height * (0.08 + f() * 0.5);
  if (f() < 0.6) return circle(x, y, width * (0.2 + f() * 0.22), ' class="b x"');
  const t = width * (0.14 + f() * 0.16);
  const angle = -50 + f() * 100;
  return `<rect x="${n(-width)}" y="${n(y - t / 2)}" width="${n(width * 3)}" height="${n(t)}" class="b x" transform="rotate(${n(angle)} ${n(x)} ${n(y)})"/>`;
}

/** The cover as an inline SVG string. Pure: the same input always gives the same markup. */
export function coverSvg(
  { id, ink, motif, project, status }: CoverInput,
  { width = 220, height = 340, instance = 0 }: CoverOptions = {},
): string {
  const stock = coverStock(id);
  const r = rng(`art:${id}`);
  const c = new Canvas(width, height, `c${hash(id).toString(36)}${instance ? `-${instance.toString(36)}` : ''}-`);
  const off = 0.9 + r() * 0.8;
  const draw = getMotif(motif) ?? getMotif('rings')!;
  try {
    draw(c, r, rng(`house:${project ?? id}`));
  } catch (error) {
    throw new Error(`inkan: motif "${motif}" failed for ${id}: ${(error as Error).message}`, { cause: error });
  }
  const motifMarkup = `<g transform="translate(${n(-off * 0.5)} ${n(off * 0.35)}) ${framing(id, width, height)}">${c.parts.join('')}</g>`;
  c.parts.length = 0;
  c.grain(Math.floor(r() * 1000), stock === 'black' ? 0.1 : 0.16);
  const full = `width="${n(width)}" height="${n(height)}"`;
  const print = `<rect ${full} class="bg"/>${motifMarkup}${overprint(id, stock, width, height)}${c.parts.join('')}`;
  const treatment = status && Object.hasOwn(TREATMENT, status) ? TREATMENT[status] : undefined;
  let body = print;
  if (treatment) {
    const filter = c.id();
    c.defs.push(
      `<filter id="${filter}" x="0" y="0" ${full} filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${treatment.filter}</filter>`,
    );
    const opacity = treatment.opacity === undefined ? '' : ` opacity="${n(treatment.opacity)}"`;
    body = `<rect ${full} class="bg"/><g filter="url(#${filter})"${opacity}>${print}</g>`;
  }
  return (
    `<svg class="cv cv--${stock}" viewBox="0 0 ${n(width)} ${n(height)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
    `style="--cv-ink:var(--inkan-ink-${ink});--cv-alt:var(--inkan-ink-${ALT[ink]})">` +
    `<defs>${c.defs.join('')}</defs>${body}</svg>`
  );
}

export type PrintTheme = 'light' | 'dark';

/** The default ink values of each theme (styles/tokens.css), for prints that live outside the page. */
export const PRINT_PALETTE: Record<PrintTheme, { inks: Record<Ink, string>; key: string; paper: string; dark: string; blend: string }> = {
  light: {
    inks: { c: '#00AEEF', m: '#FF2D8F', y: '#FFE000', g: '#00B35A', v: '#7B4DFF', o: '#FF6B1A' },
    key: '#0A0D17',
    paper: '#F4F6FA',
    dark: '#0A0D17',
    blend: 'multiply',
  },
  dark: {
    inks: { c: '#2BD4FF', m: '#FF4FA6', y: '#FFEA4A', g: '#2BEA8A', v: '#9A78FF', o: '#FF8A3D' },
    key: '#F1F4FA',
    paper: '#0B0D14',
    dark: '#0B0D14',
    blend: 'screen',
  },
};

/**
 * The cover as a self-contained SVG document: the ink roles resolved to the theme's colours in an embedded
 * stylesheet, so it renders the same in an <img>, a rasteriser or an editor (see cover.css for the roles).
 */
export function standaloneCoverSvg(input: CoverInput, { theme = 'light', ...options }: CoverOptions & { theme?: PrintTheme } = {}): string {
  const { inks, key, paper, dark, blend } = PRINT_PALETTE[theme];
  const svg = coverSvg(input, options);
  const stock = coverStock(input.id);
  const ink = inks[input.ink];
  const alt = inks[ALT[input.ink]];
  const roles =
    stock === 'flood'
      ? { bg: ink, a: paper, b: key, bl: 'normal' }
      : stock === 'black'
        ? { bg: dark, a: ink, b: alt, bl: 'screen' }
        : { bg: paper, a: ink, b: alt, bl: blend };
  const css =
    `.bg{fill:${roles.bg}}.a{fill:${roles.a}}.b{fill:${roles.b}}.k{fill:${key}}.p{fill:${paper}}.n{fill:none}` +
    `.sa{stroke:${roles.a}}.sk{stroke:${key}}.x{mix-blend-mode:${roles.bl}}.mul{mix-blend-mode:multiply}.gr{mix-blend-mode:overlay}`;
  return svg.replace(/ style="--cv-ink:[^"]*"/, '').replace('<defs>', `<style>${css}</style><defs>`);
}
