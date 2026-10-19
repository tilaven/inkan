import { describe, expect, it } from 'vitest';
import { initials, jsonHtml, matrixSvg, pad4 } from './card';

const rec = {
  id: 'sre/adr/0001-x',
  type: 'adr',
  status: 'accepted',
  date: '2026-03-02',
  tags: ['slo', 'a "quoted" <tag>'],
  supersedes: [],
  supersededBy: ['sre/adr/0002-y'],
  url: '/sre/adr/0001-x/',
};

const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

describe('jsonHtml', () => {
  it('is valid JSON once the markup is stripped', () => {
    const parsed = JSON.parse(decode(jsonHtml(rec)));
    expect(parsed).toEqual({
      id: rec.id,
      type: 'adr',
      status: 'accepted',
      date: '2026-03-02',
      tags: rec.tags,
      superseded_by: rec.supersededBy,
      url: rec.url,
    });
  });
  it('escapes markup in values', () => {
    expect(jsonHtml(rec)).not.toContain('<tag>');
  });
});

describe('matrixSvg', () => {
  it('is deterministic and differs between ids', () => {
    expect(matrixSvg('a')).toBe(matrixSvg('a'));
    expect(matrixSvg('a')).not.toBe(matrixSvg('b'));
  });
});

describe('initials and pad4', () => {
  it('handles names and handles', () => {
    expect(initials('Anna Kowalska')).toBe('AK');
    expect(initials('anna.kowalska')).toBe('AK');
    expect(initials('anna.kowalska@example.com')).toBe('AK');
    expect(initials('Jean-Pierre Nowak')).toBe('JP');
    expect(initials('solo')).toBe('S');
  });
  it('pads numbers', () => {
    expect(pad4(7)).toBe('0007');
    expect(pad4(null)).toBe('—');
    expect(pad4(null, '')).toBe('');
  });
});
