import { describe, expect, it } from 'vitest';
import { emptyState, isFiltered, matches, parseRange, parseState, serializeState, type FieldSpec, type ListRecord } from './list';

const rec: ListRecord = {
  id: 'sre/adr/0001-slos',
  project: 'sre',
  type: 'adr',
  status: 'accepted',
  people: ['ania', 'marek'],
  tags: ['slo', 'observability'],
  fields: { risk: ['medium'], pci: ['true'], cost: 25, decided: '2025-03-01' },
  text: 'define slos before dashboards #slo #observability every journey gets an slo',
};

describe('parseState / serializeState', () => {
  it('round-trips the mock query string, comma lists unescaped', () => {
    const qs = 'status=accepted,draft&project=sre&q=kafka+bus&view=table';
    const s = parseState(`?${qs}`);
    expect([...s.facets.status]).toEqual(['accepted', 'draft']);
    expect(s.q).toBe('kafka bus');
    expect(s.view).toBe('table');
    expect(serializeState(s)).toBe(qs);
  });
  it('accepts links made by filterHref and repeated keys', () => {
    const s = parseState('?tag=event%20bus&tag=slo');
    expect([...s.facets.tag]).toEqual(['event bus', 'slo']);
  });
  it('round-trips values that contain commas, spaces and ampersands', () => {
    const s = emptyState();
    s.facets.tag.add('a,b');
    s.facets.tag.add('c d');
    s.facets.author.add('x&y');
    s.q = 'kafka, bus';
    const qs = serializeState(s);
    expect(qs).toBe('author=x%26y&tag=a%2Cb,c%20d&q=kafka%2C+bus');
    const back = parseState(`?${qs}`);
    expect([...back.facets.tag]).toEqual(['a,b', 'c d']);
    expect([...back.facets.author]).toEqual(['x&y']);
    expect(back.q).toBe('kafka, bus');
  });
  it('serializes nothing for the empty state', () => {
    expect(serializeState(emptyState())).toBe('');
    expect(isFiltered(emptyState())).toBe(false);
  });
});

describe('matches', () => {
  it('matches everything with no filters', () => {
    expect(matches(rec, emptyState())).toBe(true);
  });
  it('requires every chosen facet and any of its values', () => {
    const s = parseState('?status=accepted,draft&author=marek');
    expect(matches(rec, s)).toBe(true);
    expect(matches(rec, parseState('?status=draft'))).toBe(false);
    expect(matches(rec, parseState('?tag=kafka'))).toBe(false);
  });
  it('requires every word of the free text', () => {
    expect(matches(rec, parseState('?q=SLO+dashboards'))).toBe(true);
    expect(matches(rec, parseState('?q=slo+kafka'))).toBe(false);
  });
});

const FIELDS: FieldSpec[] = [
  { name: 'risk', kind: 'chips' },
  { name: 'cost', kind: 'range' },
  { name: 'pci', kind: 'chips' },
  { name: 'decided', kind: 'range' },
];

describe('custom fields', () => {
  it('ignores field params it was not told about', () => {
    const s = parseState('?risk=high&cost=10..50');
    expect(s.chips).toEqual({});
    expect(s.ranges).toEqual({});
    expect(isFiltered(s)).toBe(false);
  });
  it('parses chips, ranges and open bounds', () => {
    const s = parseState('?risk=high,medium&pci=true&cost=10..50&decided=2025-01-01..', FIELDS);
    expect([...s.chips.risk]).toEqual(['high', 'medium']);
    expect([...s.chips.pci]).toEqual(['true']);
    expect(s.ranges.cost).toEqual({ min: '10', max: '50' });
    expect(s.ranges.decided).toEqual({ min: '2025-01-01', max: '' });
    expect(parseRange('..50')).toEqual({ min: '', max: '50' });
    expect(parseRange('42')).toEqual({ min: '42', max: '42' });
    expect(parseRange('abc..50')).toEqual({ min: '', max: '50' });
    expect(parseRange('1..2..3')).toEqual({ min: '1', max: '' });
    expect(isFiltered(s)).toBe(true);
  });
  it('serializes facets, then fields in definition order, then q and view', () => {
    const qs = 'tag=slo&risk=high&cost=10..50&pci=true&decided=..2025-12-31&q=kafka&view=table';
    const s = parseState(`?pci=true&q=kafka&decided=..2025-12-31&view=table&cost=10..50&risk=high&tag=slo`, FIELDS);
    expect(serializeState(s, FIELDS)).toBe(qs);
    expect(serializeState(parseState('?cost=42', FIELDS), FIELDS)).toBe('cost=42');
    expect(serializeState(emptyState(FIELDS), FIELDS)).toBe('');
  });
  it('matches chip fields by any value and fails records without the field', () => {
    expect(matches(rec, parseState('?risk=high,medium', FIELDS))).toBe(true);
    expect(matches(rec, parseState('?risk=high', FIELDS))).toBe(false);
    expect(matches(rec, parseState('?pci=false', FIELDS))).toBe(false);
    expect(matches({ ...rec, fields: {} }, parseState('?risk=medium', FIELDS))).toBe(false);
  });
  it('matches number ranges numerically and date ranges as strings', () => {
    const m = (qs: string) => matches(rec, parseState(qs, FIELDS));
    expect(m('?cost=10..50')).toBe(true);
    expect(m('?cost=9..')).toBe(true);
    expect(m('?cost=..9')).toBe(false);
    expect(m('?cost=100..')).toBe(false);
    expect(m('?cost=25')).toBe(true);
    expect(m('?cost=5..100&risk=low')).toBe(false);
    expect(m('?decided=2025-01-01..2025-12-31')).toBe(true);
    expect(m('?decided=2025-03-02..')).toBe(false);
    expect(matches({ ...rec, fields: {} }, parseState('?cost=..100', FIELDS))).toBe(false);
  });
});
