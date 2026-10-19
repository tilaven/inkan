import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG_HEIGHT, OG_WIDTH, ogPng, ogSvg, type OgCard } from './og';

const fontsDir = new URL('../og/fonts', import.meta.url).pathname;
const cover = { id: 'sre/adr/0001-define-slos', ink: 'c', motif: 'rings', project: 'sre' } as const;
const record: OgCard = {
  kind: 'record',
  site: 'Acme Decisions',
  project: 'SRE',
  type: 'ADR',
  number: '0001',
  title: 'Zażółć gęślą jaźń <script>',
  status: { status: 'accepted', label: 'Accepted', sticker: 'accepted' },
  date: '2025-03-12',
  cover,
};
const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

describe('ogSvg', () => {
  it('sets every text as paths, so the card needs no fonts to rasterise', async () => {
    const svg = await ogSvg(record, { fontsDir });
    expect(svg).toMatch(new RegExp(`^<svg width="${OG_WIDTH}" height="${OG_HEIGHT}"`));
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('<script>');
  });
  it('draws a card for each kind', async () => {
    const cards: OgCard[] = [
      record,
      { ...record, number: undefined, status: { status: 'parked', label: 'Parked', sticker: null, color: '#7B4DFF' } },
      { kind: 'project', site: 'Acme', eyebrow: 'Project', name: 'Payments', description: 'Money.', counts: '2 ADR', cover },
      { kind: 'site', title: 'Acme', counts: '1 project · 1 record', covers: [cover, { ...cover, id: 'b', ink: 'm' }] },
    ];
    const svgs = await Promise.all(cards.map((c) => ogSvg(c, { fontsDir })));
    expect(new Set(svgs).size).toBe(cards.length);
  });
});

describe('ogPng', () => {
  it('renders a 1200×630 PNG and reuses it from the cache', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-og-'));
    const png = await ogPng(record, { fontsDir, cacheDir });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(size(png)).toEqual([OG_WIDTH, OG_HEIGHT]);
    const [file] = fs.readdirSync(cacheDir);
    const cached = Buffer.concat([png.subarray(0, 64), Buffer.from('cached'), png.subarray(-8)]);
    fs.writeFileSync(path.join(cacheDir, file), cached);
    expect(await ogPng(record, { fontsDir, cacheDir })).toEqual(cached);
    fs.writeFileSync(path.join(cacheDir, file), png.subarray(0, 1000));
    expect(await ogPng(record, { fontsDir, cacheDir })).toEqual(png);
    await ogPng({ ...record, title: 'Other' }, { fontsDir, cacheDir });
    expect(fs.readdirSync(cacheDir)).toHaveLength(2);
    fs.rmSync(cacheDir, { recursive: true });
  });
  it('still returns the card when the cache cannot be written', async () => {
    const blocker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dh-og-')), 'file');
    fs.writeFileSync(blocker, '');
    expect(size(await ogPng(record, { fontsDir, cacheDir: path.join(blocker, 'og') }))).toEqual([OG_WIDTH, OG_HEIGHT]);
    fs.rmSync(path.dirname(blocker), { recursive: true });
  });
  it('prints on Stage when asked', async () => {
    const [light, dark] = await Promise.all([ogSvg(record, { fontsDir }), ogSvg(record, { fontsDir, theme: 'dark' })]);
    expect(light).toContain('#F2F5FA');
    expect(dark).toContain('#05060A');
  });
});
