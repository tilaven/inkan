/**
 * Open Graph cards (1200×630 PNG): the record's cover beside its number, title and status, so links unfurl
 * in Slack, Teams and the like. Laid out with satori (text becomes paths), rasterised with resvg.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderAsync } from '@resvg/resvg-js';
import satori from 'satori';
import { PRINT_PALETTE, standaloneCoverSvg, type PrintTheme } from './covers';
import { stickerSvg } from './stickers';
import type { Ink } from './inks';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** The cover keeps the photocard's 55×85 proportions at full card height. */
const COVER_WIDTH = Math.round((OG_HEIGHT * 55) / 85);
const PAD = 72;
const TEXT_WIDTH = OG_WIDTH - COVER_WIDTH - PAD * 2;

interface Cover {
  id: string;
  ink: Ink;
  motif: string;
  project?: string;
  status?: string;
}

interface Sticker {
  status: string;
  label: string;
  sticker: string | null;
  color?: string;
}

export type OgCard =
  | {
      kind: 'record';
      site: string;
      project: string;
      type: string;
      number?: string;
      title: string;
      status?: Sticker;
      date?: string;
      cover: Cover;
    }
  | { kind: 'project'; site: string; eyebrow: string; name: string; description?: string; counts: string; cover: Cover }
  | { kind: 'site'; title: string; tagline?: string; counts: string; covers: Cover[]; art?: Art };

/** A raster picture as a data URI with its size in pixels. */
interface Art {
  src: string;
  width: number;
  height: number;
}

/** The site card's picture fits this box, in a side panel 40px wider than it. */
const ART_BOX = { width: 520, height: 520 };

interface Node {
  type: string;
  props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown };
}

const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | false | undefined)[]): Node => ({
  type,
  props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children: children.filter((c) => c !== false && c !== undefined) },
});

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const img = (src: string, width: number, height: number, style: Record<string, unknown> = {}): Node => ({
  type: 'img',
  props: { src, width, height, style },
});

const COLORS: Record<PrintTheme, { bg: string; fg: string; fg3: string; rule: string }> = {
  light: { bg: '#F2F5FA', fg: '#0A0D17', fg3: '#586279', rule: '#0A0D17' },
  dark: { bg: '#05060A', fg: '#F1F4FA', fg3: '#7F89A0', rule: '#F1F4FA' },
};

/** A name set big: the longer it is, the smaller the type, down to a size that fits `lines` lines. */
const display = (text: string, lines: number) => ({
  fontFamily: 'Anybody Title',
  fontSize: text.length <= 12 ? 112 : text.length <= 20 ? 92 : 72,
  lineHeight: 1,
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.01em',
  lineClamp: lines,
  display: 'block',
  maxWidth: TEXT_WIDTH,
});

const mono = { fontFamily: 'Martian Mono', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' };

function sticker(s: Sticker, size: number, style: Record<string, unknown>): Node {
  const art = img(svgUri(stickerSvg(s.status, { label: s.label, sticker: s.sticker, color: s.color, glyph: !!s.sticker })), size, size, {
    position: 'absolute',
    top: 0,
    left: 0,
  });
  const letter =
    !s.sticker &&
    h(
      'div',
      { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', fontFamily: 'Anybody Number', fontSize: size * 0.36, color: '#0A0D17' },
      (s.label.trim()[0] ?? '?').toUpperCase(),
    );
  return h('div', { position: 'absolute', width: size, height: size, transform: 'rotate(9deg)', ...style }, art, letter);
}

function card(c: OgCard, theme: PrintTheme): Node {
  const { bg, fg, fg3, rule } = COLORS[theme];
  const inks = PRINT_PALETTE[theme].inks;
  const shell = (left: Node, right: Node, overlay?: Node | false) =>
    h('div', { width: OG_WIDTH, height: OG_HEIGHT, background: bg, color: fg, position: 'relative' }, left, right, overlay || undefined);
  const column = (...children: (Node | false | undefined)[]) =>
    h('div', { flexDirection: 'column', justifyContent: 'space-between', width: OG_WIDTH - COVER_WIDTH, flexShrink: 0, padding: `60px ${PAD}px 56px` }, ...children);
  const coverPanel = (cover: Cover) =>
    h(
      'div',
      { width: COVER_WIDTH, height: OG_HEIGHT, flexShrink: 0, borderLeft: `6px solid ${rule}` },
      img(svgUri(standaloneCoverSvg(cover, { theme, width: COVER_WIDTH - 6, height: OG_HEIGHT })), COVER_WIDTH - 6, OG_HEIGHT),
    );
  const eyebrow = (label: string, ink: Ink, rest?: string) =>
    h(
      'div',
      { ...mono, fontSize: 22, alignItems: 'center', color: fg },
      h('div', { width: 36, height: 3, background: fg, marginRight: 18 }),
      h('div', { borderBottom: `5px solid ${inks[ink]}`, paddingBottom: 4 }, label),
      rest && h('div', { color: fg3, marginLeft: 16 }, `· ${rest}`),
    );
  const foot = (left: string, right?: string) =>
    h(
      'div',
      { ...mono, fontSize: 20, color: fg3, justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `2px solid ${fg3}`, paddingTop: 20 },
      h('div', {}, left),
      right ? h('div', { color: fg }, right) : undefined,
    );

  if (c.kind === 'record') {
    const ink = inks[c.cover.ink];
    const title = h(
      'div',
      {
        fontFamily: 'Anybody Title',
        fontSize: c.number ? 62 : 74,
        lineHeight: 1,
        textTransform: 'uppercase',
        letterSpacing: '-0.01em',
        lineClamp: c.number ? 3 : 4,
        display: 'block',
        maxWidth: c.status ? 640 : undefined,
      },
      c.title,
    );
    const number =
      c.number &&
      h('div', { fontFamily: 'Anybody Number', fontSize: 128, lineHeight: 1, letterSpacing: '0.01em', color: fg, textShadow: `7px 7px 0 ${ink}`, marginBottom: 18 }, c.number);
    const meta = [c.status?.label, c.date].filter(Boolean).join(' · ');
    return shell(
      column(eyebrow(c.project, c.cover.ink, c.type), h('div', { flexDirection: 'column' }, number, title), foot(meta || c.type, c.site)),
      coverPanel(c.cover),
      c.status && sticker(c.status, 150, { top: 36, left: OG_WIDTH - COVER_WIDTH - 96 }),
    );
  }

  if (c.kind === 'project') {
    return shell(
      column(
        eyebrow(c.eyebrow, c.cover.ink),
        h(
          'div',
          { flexDirection: 'column' },
          h('div', { ...display(c.name, 2), textShadow: `6px 6px 0 ${inks[c.cover.ink]}` }, c.name),
          c.description &&
            h('div', { fontFamily: 'Instrument Sans', fontWeight: 500, fontSize: 32, lineHeight: 1.35, color: fg3, marginTop: 28, lineClamp: 3, display: 'block', maxWidth: TEXT_WIDTH }, c.description),
        ),
        foot(c.counts, c.site),
      ),
      coverPanel(c.cover),
    );
  }

  const side = c.art ? ART_BOX.width + 40 : COVER_WIDTH + 40;
  const fit = c.art ? Math.min(ART_BOX.width / c.art.width, ART_BOX.height / c.art.height) : 0;
  const fan = c.art ? h(
    'div',
    { width: side, height: OG_HEIGHT, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingRight: 40 },
    img(c.art.src, Math.round(c.art.width * fit), Math.round(c.art.height * fit)),
  ) : h(
    'div',
    { width: COVER_WIDTH + 40, height: OG_HEIGHT, flexShrink: 0, position: 'relative' },
    ...c.covers.slice(0, 3).map((cover, i, all) => {
      const w = 236;
      const ht = Math.round((w * 85) / 55);
      const spread = all.length === 1 ? [0] : all.length === 2 ? [-1, 1] : [-1, 0, 1];
      const at = spread[i];
      return h(
        'div',
        {
          position: 'absolute',
          left: (COVER_WIDTH + 40 - w) / 2 + at * 100,
          top: (OG_HEIGHT - ht) / 2 + Math.abs(at) * 26,
          transform: `rotate(${at * 9}deg)`,
          border: `5px solid ${rule}`,
          borderRadius: 14,
          overflow: 'hidden',
        },
        img(svgUri(standaloneCoverSvg(cover, { theme, width: w, height: ht })), w, ht),
      );
    }),
  );
  return shell(
    h(
      'div',
      { flexDirection: 'column', justifyContent: 'space-between', width: OG_WIDTH - side, flexShrink: 0, padding: `60px 0 56px ${PAD}px` },
      h('div', { ...mono, fontSize: 22, color: fg3 }, 'ADR · RFC'),
      h(
        'div',
        { flexDirection: 'column' },
        h('div', { ...display(c.title, 3), maxWidth: Math.min(TEXT_WIDTH, OG_WIDTH - side - PAD * 2) }, c.title),
        c.tagline && h('div', { fontFamily: 'Instrument Sans', fontWeight: 500, fontSize: 32, lineHeight: 1.35, color: fg3, marginTop: 28, lineClamp: 3, display: 'block', maxWidth: c.art ? OG_WIDTH - side - PAD * 2 : TEXT_WIDTH - PAD }, c.tagline),
      ),
      h('div', { ...mono, fontSize: 20, color: fg3, borderTop: `2px solid ${fg3}`, paddingTop: 20 }, c.counts),
    ),
    fan,
  );
}

const FONTS = [
  ['Anybody Title', 'anybody-title', 800],
  ['Anybody Number', 'anybody-number', 900],
  ['Martian Mono', 'martian-mono', 600],
  ['Instrument Sans', 'instrument-sans', 500],
] as const;

type Font = { name: string; data: Buffer; weight: 500 | 600 | 800 | 900; style: 'normal' };
const fonts = new Map<string, Promise<Font[]>>();
function loadFonts(dir: string) {
  let loaded = fonts.get(dir);
  if (!loaded) {
    loaded = Promise.all(FONTS.map(async ([name, file, weight]) => ({ name, data: await fs.readFile(path.join(dir, `${file}.woff`)), weight, style: 'normal' as const })));
    fonts.set(dir, loaded);
    loaded.catch(() => fonts.delete(dir));
  }
  return loaded;
}

const IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
/** A cached file counts only when it is a whole PNG: a build killed mid-write must not leave a broken card behind. */
const isPng = (b: Buffer) => b.length > 64 && b.readUInt32BE(0) === 0x89504e47 && b.subarray(-8).equals(IEND);

export interface RenderOptions {
  theme?: PrintTheme;
  /** Folder with the card fonts (`app/src/og/fonts`). */
  fontsDir: string;
  /** Finished cards are kept here by content hash, so unchanged records are not redrawn on the next build. */
  cacheDir?: string;
}

/** The card as SVG markup (text as paths). */
export async function ogSvg(c: OgCard, { theme = 'light', fontsDir }: RenderOptions): Promise<string> {
  return satori(card(c, theme) as Parameters<typeof satori>[0], { width: OG_WIDTH, height: OG_HEIGHT, fonts: await loadFonts(fontsDir) });
}

/** The card as a PNG. */
export async function ogPng(c: OgCard, options: RenderOptions): Promise<Buffer> {
  const svg = await ogSvg(c, options);
  const { cacheDir } = options;
  const cached = cacheDir && path.join(cacheDir, `${createHash('sha256').update(svg).digest('hex').slice(0, 32)}.png`);
  if (cached) {
    const hit = await fs.readFile(cached).catch(() => undefined);
    if (hit && isPng(hit)) return hit;
  }
  const png = (await renderAsync(svg, { font: { loadSystemFonts: false } })).asPng();
  if (cached) {
    // The cache only saves time: a read-only or full disk must not fail the build.
    const tmp = `${cached}.${process.pid}.tmp`;
    await fs
      .mkdir(cacheDir, { recursive: true })
      .then(() => fs.writeFile(tmp, png))
      .then(() => fs.rename(tmp, cached))
      .catch(() => fs.rm(tmp, { force: true }).catch(() => {}));
  }
  return png;
}
