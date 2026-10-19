import { describe, expect, it, vi } from 'vitest';
import { buildGraph, layoutGraph, normalizeRef, type GraphRecord } from './graph';

vi.mock('virtual:inkan/motifs', () => ({ default: {} }));
import type { ProjectStyle } from './inks';

const rec = (id: string, extra: Partial<GraphRecord> = {}): GraphRecord => ({
  id,
  href: `/${id}/`,
  title: id,
  project: id.split('/')[0],
  ref: null,
  number: null,
  supersedes: [],
  supersededBy: [],
  related: [],
  ...extra,
});
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('buildGraph', () => {
  it('deduplicates a supersede listed on both sides', () => {
    const g = buildGraph([rec('p/adr/1', { supersededBy: ['p/adr/2'] }), rec('p/adr/2', { supersedes: ['p/adr/1'] })]);
    expect(g.edges).toEqual([{ from: 'p/adr/2', to: 'p/adr/1', kind: 'supersedes' }]);
    expect(g.nodes.map((n) => n.degree)).toEqual([1, 1]);
  });
  it('stores related once with from < to, whichever side lists it', () => {
    const g = buildGraph([rec('p/adr/2', { related: ['p/adr/1'] }), rec('p/adr/1', { related: ['p/adr/2'] })]);
    expect(g.edges).toEqual([{ from: 'p/adr/1', to: 'p/adr/2', kind: 'related' }]);
  });
  it('drops related when the pair is also superseding', () => {
    const g = buildGraph([rec('p/adr/1', { related: ['p/adr/2'] }), rec('p/adr/2', { supersedes: ['p/adr/1'] })]);
    expect(g.edges.map((e) => e.kind)).toEqual(['supersedes']);
  });
  it('keeps opposite dangling supersedes apart', () => {
    const g = buildGraph([rec('p/adr/1', { supersedes: ['x'], supersededBy: ['x'] })]);
    expect(g.dangling).toEqual([
      { from: 'p/adr/1', to: 'x', kind: 'supersedes' },
      { from: 'x', to: 'p/adr/1', kind: 'supersedes' },
    ]);
  });
  it('normalises references', () => {
    expect(normalizeRef('/X/adr/1.md')).toBe('x/adr/1');
    expect(normalizeRef('./X/adr/1/')).toBe('x/adr/1');
    expect(normalizeRef('../../x/adr/1.md')).toBe('x/adr/1');
    const g = buildGraph([rec('x/adr/1'), rec('x/adr/2', { related: ['/X/ADR/1.md'] })]);
    expect(g.edges).toHaveLength(1);
    expect(g.dangling).toEqual([]);
  });
  it('collects dangling references once, supersededBy as supersedes', () => {
    const g = buildGraph([rec('p/adr/1', { supersededBy: ['p/adr/9', '/p/adr/9.md'], related: ['q/nope'], supersedes: ['q/old'] })]);
    expect(g.dangling).toEqual([
      { from: 'p/adr/1', to: 'q/nope', kind: 'related' },
      { from: 'p/adr/1', to: 'q/old', kind: 'supersedes' },
      { from: 'p/adr/9', to: 'p/adr/1', kind: 'supersedes' },
    ]);
    expect(g.nodes).toEqual([]);
    expect(g.unlinked).toBe(1);
  });
  it('counts unlinked records and ignores self links', () => {
    const g = buildGraph([rec('p/adr/1', { related: ['p/adr/1'], supersedes: ['P/adr/1'] }), rec('p/adr/2'), rec('p/adr/3', { related: ['p/adr/2'] })]);
    expect(g.nodes.map((n) => n.id)).toEqual(['p/adr/2', 'p/adr/3']);
    expect(g.unlinked).toBe(1);
  });
  it('formats dates and omits missing ones', () => {
    const g = buildGraph([rec('p/adr/1', { date: d('2024-03-05'), related: ['p/adr/2'] }), rec('p/adr/2')]);
    expect(g.nodes[0].date).toBe('2024-03-05');
    expect('date' in g.nodes[1]).toBe(false);
  });
});

const style = (id: string, ink: ProjectStyle['ink'] = 'c'): ProjectStyle => ({ id, name: id.toUpperCase(), ink, motif: 'x' });
const styles = new Map([['b', style('b', 'm')], ['a', style('a', 'g')]]);

describe('layoutGraph', () => {
  const sample = () =>
    buildGraph([
      rec('a/adr/1', { date: d('2023-12-30'), related: ['b/adr/1'] }),
      rec('b/adr/1', { date: d('2024-03-02') }),
      rec('b/adr/2', { date: d('2024-03-01'), supersedes: ['a/adr/1'] }),
      rec('c/adr/1', { related: ['a/adr/1'] }),
    ]);

  it('orders lanes by `order`, appends the rest and falls back for unknown styles', () => {
    const l = layoutGraph(sample(), styles, ['b', 'a']);
    expect(l.lanes.map((x) => x.project)).toEqual(['b', 'a', 'c']);
    expect(l.lanes[0]).toMatchObject({ name: 'B', ink: 'm', y: 48 });
    expect(l.lanes[2].name).toBe('c');
    expect(l.lanes[2].ink).toMatch(/^[cmygvo]$/);
  });
  it('builds sparse month columns with years and an undated column last', () => {
    const l = layoutGraph(sample(), styles, ['a', 'b', 'c']);
    expect(l.columns.map((c) => [c.key, c.label, c.year, c.x])).toEqual([
      ['2023-12', 'DEC', '2023', 132],
      ['2024-03', 'MAR', '2024', 308],
      ['undated', '—', undefined, 484],
    ]);
    expect(l.width).toBe(132 + 3 * 176 + 24);
  });
  it('stacks records of a cell by date and sizes lanes', () => {
    const l = layoutGraph(sample(), styles, ['a', 'b', 'c']);
    const b2 = l.nodes.find((n) => n.id === 'b/adr/2')!;
    const b1 = l.nodes.find((n) => n.id === 'b/adr/1')!;
    const lane = l.lanes.find((x) => x.project === 'b')!;
    expect(b2.y).toBe(lane.y + 12);
    expect(b1.y).toBe(lane.y + 12 + 56);
    expect(b1.x).toBe(308 + 12);
    expect(lane.height).toBe(24 + 2 * 56 - 12);
    const [a, , c] = l.lanes;
    expect(a.y).toBe(48);
    expect(l.lanes[1].y).toBe(a.y + a.height);
    expect(l.height).toBe(c.y + c.height + 16);
  });
  it('draws supersedes from the older node to the newer one', () => {
    const l = layoutGraph(sample(), styles, ['a', 'b', 'c']);
    const old = l.nodes.find((n) => n.id === 'a/adr/1')!;
    const next = l.nodes.find((n) => n.id === 'b/adr/2')!;
    const e = l.edges.find((x) => x.kind === 'supersedes')!;
    expect(e.d.startsWith(`M${old.x + 152} ${old.y + 22}C`)).toBe(true);
    expect(e.d.endsWith(` ${next.x} ${next.y + 22}`)).toBe(true);
  });
  it('mirrors leftward edges and loops within a column', () => {
    const g = buildGraph([
      rec('a/adr/1', { date: d('2024-02-01'), related: ['a/adr/2', 'a/adr/3'] }),
      rec('a/adr/2', { date: d('2024-01-01') }),
      rec('a/adr/3', { date: d('2024-02-09') }),
    ]);
    const l = layoutGraph(g, styles, ['a']);
    const [left, loop] = l.edges;
    const n1 = l.nodes.find((n) => n.id === 'a/adr/1')!;
    expect(left.d.startsWith(`M${n1.x} `)).toBe(true);
    expect(loop.d).toContain(`C${n1.x + 152 + 48} `);
  });
  it('is deterministic', () => {
    const a = JSON.stringify(layoutGraph(sample(), styles, ['a']));
    expect(JSON.stringify(layoutGraph(sample(), styles, ['a']))).toBe(a);
    expect(JSON.stringify(layoutGraph(buildGraph([]), styles, []))).toContain('"lanes":[]');
  });
  it('handles thousands of nodes quickly', () => {
    const recs = Array.from({ length: 5000 }, (_, i) =>
      rec(`p${i % 7}/adr/${i}`, { date: d(`20${10 + (i % 15)}-0${1 + (i % 9)}-01`), related: [`p${(i + 1) % 7}/adr/${(i + 1) % 5000}`] }),
    );
    const l = layoutGraph(buildGraph(recs), new Map(), []);
    expect(l.nodes).toHaveLength(5000);
    expect(l.edges).toHaveLength(4999);
  });
});
