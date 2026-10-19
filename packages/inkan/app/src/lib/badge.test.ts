import { describe, expect, it } from 'vitest';
import { badgeJson, badgeSvg, charWidth, textWidth } from './badge';
import { escapeXml } from './xml';

describe('textWidth', () => {
  it('estimates per character and rounds to a tenth', () => {
    expect(charWidth('i')).toBeLessThan(charWidth('a'));
    expect(charWidth('a')).toBeLessThan(charWidth('A'));
    expect(charWidth('A')).toBeLessThan(charWidth('W'));
    expect(textWidth('')).toBe(0);
    expect(textWidth('42')).toBe(14);
    expect(textWidth('records')).toBe(6.8 * 5 + 4.5 * 2);
    expect(textWidth('Ünïcode')).toBe(8 + 6.8 + 8 + 6.8 * 4);
  });
});

describe('escapeXml', () => {
  it('escapes the five XML characters', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  });
});

describe('badgeSvg', () => {
  const svg = badgeSvg({ label: 'records', message: '42', color: 'blue' });

  it('sizes the two halves from the text widths', () => {
    const left = Math.round(textWidth('records') + 10);
    const right = Math.round(textWidth('42') + 10);
    expect(svg).toContain(`width="${left + right}" height="20"`);
    expect(svg).toContain(`<rect width="${left}" height="20" fill="#555"/>`);
    expect(svg).toContain(`<rect x="${left}" width="${right}" height="20" fill="#007ec6"/>`);
    expect(svg).toContain(`textLength="${textWidth('records') * 10}"`);
    expect(svg).toContain('<title>records: 42</title>');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('escapes label and message', () => {
    const s = badgeSvg({ label: 'R&D <x>', message: '"1"', color: 'brightgreen' });
    expect(s).toContain('aria-label="R&amp;D &lt;x&gt;: &quot;1&quot;"');
    expect(s).toContain('>R&amp;D &lt;x&gt;</text>');
    expect(s).not.toMatch(/<x>/);
    expect(s).toContain('fill="#4c1"');
  });

  it('writes shields endpoint JSON', () => {
    expect(badgeJson({ label: 'accepted', message: '7', color: 'brightgreen' })).toEqual({ schemaVersion: 1, label: 'accepted', message: '7', color: 'brightgreen' });
  });
});
