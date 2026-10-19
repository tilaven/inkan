import { describe, expect, it } from 'vitest';
import { blobUrl, globMatcher } from '../lib/coderefs.mjs';
import { defaults } from '../lib/defaults.mjs';

describe('code references', () => {
  it('skips Markdown by default', () => {
    const md = defaults.codeRefs.exclude.map(globMatcher);
    expect(md.some((m) => m('README.md'))).toBe(true);
    expect(md.some((m) => m('docs/guide.mdx'))).toBe(true);
    expect(md.some((m) => m('src/app.ts'))).toBe(false);
  });

  it('encodes file names in links', () => {
    expect(blobUrl({ url: 'https://github.com/a/b', branch: 'main' }, 'docs/100% #1?.cs', 3)).toBe('https://github.com/a/b/blob/main/docs/100%25%20%231%3F.cs#L3');
  });
});
