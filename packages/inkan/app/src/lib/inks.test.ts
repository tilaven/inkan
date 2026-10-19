import { describe, expect, it } from 'vitest';
import { INKS, assignStyles, checkMotif, fallbackStyle, type Ink, type ProjectStyle } from './inks';
import { motifNames } from './motif-registry';

const motifs = Array.from({ length: 12 }, (_, i) => `m${i}`);
const palette = { motifs };
const ids = (count: number, prefix = 'team') => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${String(i).padStart(3, '0')}` }));
const pairs = (styles: Map<string, ProjectStyle>) => [...styles.values()].map((s) => `${s.ink}:${s.motif}`);

describe('assignStyles', () => {
  it('gives 72 projects 72 distinct (ink, motif) pairs', () => {
    const styles = assignStyles(ids(72), palette);
    expect(styles.size).toBe(72);
    expect(new Set(pairs(styles)).size).toBe(72);
    for (const s of styles.values()) {
      expect(INKS).toContain(s.ink);
      expect(motifs).toContain(s.motif);
    }
  });

  it('is deterministic and keeps the id as the name by default', () => {
    expect(assignStyles(ids(10), palette)).toEqual(assignStyles(ids(10), palette));
    expect(assignStyles([{ id: 'sre' }], palette).get('sre')?.name).toBe('sre');
    expect(assignStyles([{ id: 'sre', name: 'SRE' }], palette).get('sre')?.name).toBe('SRE');
  });

  it('respects pinned inks and motifs, and reserves them before anyone else picks', () => {
    const everyone = ids(60);
    const free = assignStyles(everyone, palette);
    const wanted = free.get('team-000')!;
    const pinned = assignStyles([...everyone, { id: 'zzz', ink: wanted.ink, motif: wanted.motif }], palette);
    expect(pinned.get('zzz')).toMatchObject({ ink: wanted.ink, motif: wanted.motif });
    expect(`${pinned.get('team-000')!.ink}:${pinned.get('team-000')!.motif}`).not.toBe(`${wanted.ink}:${wanted.motif}`);
    expect(new Set(pairs(pinned)).size).toBe(61);
  });

  it('picks a free motif for a pinned ink, and a free ink for a pinned motif', () => {
    const styles = assignStyles([...ids(20), { id: 'inky', ink: 'v' }, { id: 'shapely', motif: 'm3' }], palette);
    expect(styles.get('inky')!.ink).toBe('v');
    expect(styles.get('shapely')!.motif).toBe('m3');
    expect(new Set(pairs(styles)).size).toBe(22);
  });

  it('keeps half pins from taking the motif another half pin needs', () => {
    const inkPins = INKS.map((ink) => ({ id: `ink-${ink}`, ink }));
    const styles = assignStyles([...inkPins, { id: 'zz', motif: 'm0' }], { motifs: ['m0', 'm1'] });
    for (const { id } of inkPins) expect(styles.get(id)!.motif).toBe('m1');
    expect(new Set([...styles.values()].map((s) => `${s.ink}:${s.motif}`)).size).toBe(INKS.length + 1);
  });

  it('prefers motifs whose keywords appear in the project id or name', () => {
    const keywords = { m3: ['security'], m7: ['frontend', 'web'] };
    const styles = assignStyles([{ id: 'appsec' }, { id: 'security' }, { id: 'team-a', name: 'Web Platform' }, { id: 'security-tools' }], { motifs, keywords });
    expect(styles.get('security')!.motif).toBe('m3');
    expect(styles.get('security-tools')!.motif).toBe('m3');
    expect(styles.get('security')!.ink).not.toBe(styles.get('security-tools')!.ink);
    expect(styles.get('team-a')!.motif).toBe('m7');
    expect(styles.get('appsec')!.motif).not.toBe('m3');
  });

  it('does not change earlier projects when one is added after them in id order', () => {
    const before = assignStyles(ids(30), palette);
    const after = assignStyles([...ids(30), { id: 'zebra' }, { id: 'yak' }], palette);
    for (const [id, style] of before) expect(after.get(id)).toEqual(style);
  });

  it('reserves a pin added later before earlier unpinned projects', () => {
    const before = assignStyles(ids(30), palette);
    const moved = [...before.values()].find((s) => s.id > 'team-000')!;
    const after = assignStyles([...ids(30), { id: 'zzz', ink: moved.ink, motif: moved.motif }], palette);
    expect(after.get('zzz')).toMatchObject({ ink: moved.ink, motif: moved.motif });
    expect(after.get(moved.id)).not.toEqual(moved);
    expect(new Set(pairs(after)).size).toBe(31);
  });

  it('allows repeats only once every pair is taken', () => {
    const all = INKS.length * motifs.length;
    const full = assignStyles(ids(all), palette);
    expect(new Set(pairs(full)).size).toBe(all);
    const over = assignStyles(ids(all + 5), palette);
    expect(new Set(pairs(over)).size).toBe(all);
    for (const [id, style] of full) expect(over.get(id)).toEqual(style);
  });

  it('works with a single ink', () => {
    const styles = assignStyles(ids(12), { inks: ['m'] as Ink[], motifs });
    expect(new Set(pairs(styles)).size).toBe(12);
  });

  it('uses the registered motifs by default', () => {
    expect(motifNames()).toContain(assignStyles([{ id: 'sre' }]).get('sre')!.motif);
  });
});

describe('built-in identities', () => {
  it('give common team names their themed motif', () => {
    const teams = { dbre: 'discs', security: 'shield', frontend: 'browser', 'mobile-apps': 'phone', 'ml-platform': 'neural', payments: 'card', sre: 'rings',
      'incident-response': 'siren', 'data-warehouse': 'lake', iot: 'chip', 'api-gateway': 'plug', 'fraud-prevention': 'eye', talent: 'people',
      legal: 'scales', sales: 'magnet', logistics: 'truck', 'game-studio': 'gamepad', sustainability: 'leaf', docs: 'book' };
    const styles = assignStyles(Object.keys(teams).map((id) => ({ id })));
    for (const [id, motif] of Object.entries(teams)) expect([id, styles.get(id)!.motif]).toEqual([id, motif]);
  });

  it('give every team a distinct pair while ink x motif pairs remain', () => {
    const total = INKS.length * motifNames().length;
    const styles = assignStyles(Array.from({ length: total }, (_, i) => ({ id: `team-${i}` })));
    expect(new Set([...styles.values()].map((s) => `${s.ink}:${s.motif}`)).size).toBe(total);
  });
});

describe('checkMotif', () => {
  it('passes a known motif', () => {
    expect(() => checkMotif('sre', 'rings', motifNames())).not.toThrow();
  });
  it('fails an unknown motif with the available names and a hint', () => {
    expect(() => assignStyles([{ id: 'sre', motif: 'ring' }])).toThrow(
      /project "sre": unknown motif "ring", did you mean "rings"\? \(available: .*\barcs\b.*\brings\b/,
    );
    expect(() => assignStyles([{ id: 'sre', motif: 'spirals' }])).toThrow(/unknown motif "spirals" \(available: /);
  });
});

describe('fallbackStyle', () => {
  it('is stable and valid', () => {
    expect(fallbackStyle('payments')).toEqual(fallbackStyle('payments'));
    expect(INKS).toContain(fallbackStyle('payments').ink);
    expect(motifNames()).toContain(fallbackStyle('payments').motif);
  });
});
