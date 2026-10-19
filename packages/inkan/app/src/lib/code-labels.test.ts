import { ExpressiveCodeEngine, pluginFrames } from 'astro-expressive-code';
import { toHtml } from 'hast-util-to-html';
import { describe, expect, it } from 'vitest';
import { codeLabel, pluginCodeLabels } from './code-labels.mjs';

const render = async (code: string, language: string, meta = '') => {
  const engine = new ExpressiveCodeEngine({ plugins: [pluginFrames(), pluginCodeLabels()] });
  const { renderedGroupAst } = await engine.render({ code, language, meta });
  return toHtml(renderedGroupAst);
};

describe('pluginCodeLabels', () => {
  it('labels a block by its title', async () => {
    expect(await render('a', 'ts', 'title="inkan.config.ts"')).toMatch(/<pre[^>]* data-label="inkan.config.ts"/);
  });

  it('falls back to the language', async () => {
    expect(await render('a', 'yaml')).toMatch(/<pre[^>]* data-label="yaml"/);
    expect(await render('a', 'plaintext')).toMatch(/<pre[^>]* data-label="text"/);
  });

  it('ships the module that names the block while it is a region', () => {
    const modules = pluginCodeLabels({ label: 'Blok kodu {n}: {name}' }).jsModules as string[];
    expect(modules).toHaveLength(1);
    expect(modules[0]).toContain("attributeFilter: ['role']");
    expect(modules[0]).toContain('"Blok kodu {n}: {name}"');
    expect(codeLabel({ props: { title: ' x.ts ' }, language: 'ts' })).toBe('x.ts');
  });
});
