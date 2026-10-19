import { describe, expect, it } from 'vitest';
import { BUILT_IN_STICKERS, glyphFor, stickerFor, stickerMaskCss, stickerSvg } from './stickers';

describe('stickerFor', () => {
  it('returns the built-in sticker for a known status', () => {
    expect(stickerFor('accepted')).toBe('accepted');
  });
  it('lets config borrow a built-in sticker', () => {
    expect(stickerFor('approved', 'accepted')).toBe('accepted');
  });
  it('falls back to null for an unknown status', () => {
    expect(stickerFor('on-hold')).toBeNull();
    expect(stickerFor('on-hold', 'nonsense')).toBeNull();
  });
});

describe('glyphFor', () => {
  it('draws the first letter of the label for the fallback sticker', () => {
    expect(glyphFor(null, 'On hold')).toContain('>O</text>');
  });
  it('escapes the letter', () => {
    expect(glyphFor(null, '<x')).not.toContain('<x');
  });
  it('returns every built-in glyph', () => {
    for (const s of BUILT_IN_STICKERS) expect(glyphFor(s, s)).toContain('currentColor');
  });
});

describe('stickerMaskCss', () => {
  it('defines a silhouette and an outline per built-in sticker', () => {
    const css = stickerMaskCss();
    for (const s of BUILT_IN_STICKERS) {
      expect(css).toContain(`--stk-${s}:`);
      expect(css).toContain(`--stk-out-${s}:`);
    }
  });
});

describe('stickerSvg', () => {
  it('is a self-contained document for every built-in sticker', () => {
    for (const sticker of BUILT_IN_STICKERS) {
      const svg = stickerSvg(sticker);
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      expect(svg).not.toContain('var(--');
    }
  });
  it('gives foil statuses a gradient and custom ones their colour and letter', () => {
    expect(stickerSvg('implemented')).toContain('url(#foil)');
    const custom = stickerSvg('parked', { label: 'Parked', sticker: null, color: '#123456' });
    expect(custom).toContain('#123456');
    expect(custom).toContain('>P</text>');
    expect(stickerSvg('parked', { sticker: null, glyph: false })).not.toContain('<text');
  });
});
