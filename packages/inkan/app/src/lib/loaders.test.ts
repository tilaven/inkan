import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { globs } from './loaders';

/** The parts of a loader context the glob loader touches, backed by a Map. */
function context(root: string) {
  const entries = new Map<string, { id: string; filePath?: string; digest?: string; data: unknown }>();
  const store = {
    get: (id: string) => entries.get(id),
    entries: () => [...entries.entries()],
    values: () => [...entries.values()],
    keys: () => [...entries.keys()],
    has: (id: string) => entries.has(id),
    set: (entry: { id: string }) => {
      entries.set(entry.id, entry as never);
      return true;
    },
    delete: (id: string) => {
      entries.delete(id);
    },
    clear: () => entries.clear(),
    addAssetImport: () => {},
    addAssetImports: () => {},
    addModuleImport: () => {},
  };
  const entryTypes = new Map([
    ['.md', { extensions: ['.md'], getEntryInfo: async ({ contents }: { contents: string }) => ({ data: {}, body: contents, slug: '', rawData: '' }) }],
  ]);
  return {
    entries,
    ctx: {
      config: { root: new URL(`file://${root}/`), srcDir: new URL(`file://${root}/src/`) },
      collection: 'docs',
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      parseData: async ({ data }: { data: unknown }) => data,
      generateDigest: (s: string) => String(s.length),
      entryTypes,
      store,
    } as never,
  };
}

describe('globs', () => {
  it('fills one collection from several folders without one glob removing the entries of another', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-globs-'));
    const write = (f: string, text = `# ${f}\n`) => {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), text);
    };
    write('decisions/sre/adr/0001-a.md');
    write('src-checkout/adr/0001-b.md');
    write('src-search/adr/0001-c.md');
    const loader = globs([
      { base: path.join(root, 'decisions'), pattern: '**/*.md' },
      { base: path.join(root, 'src-checkout'), pattern: '**/*.md', generateId: ({ entry }) => `checkout/${entry.replace(/\.md$/, '')}` },
      { base: path.join(root, 'src-search'), pattern: '**/*.md', generateId: ({ entry }) => `search/${entry.replace(/\.md$/, '')}` },
    ]);
    const { ctx, entries } = context(root);
    await loader.load(ctx);
    expect([...entries.keys()].sort()).toEqual(['checkout/adr/0001-b', 'search/adr/0001-c', 'sre/adr/0001-a']);

    // A second run (dev restart) drops only what disappeared from its own folder.
    fs.rmSync(path.join(root, 'src-checkout/adr/0001-b.md'));
    write('src-search/adr/0002-d.md');
    await loader.load(ctx);
    expect([...entries.keys()].sort()).toEqual(['search/adr/0001-c', 'search/adr/0002-d', 'sre/adr/0001-a']);
  });

  it('still removes records deleted between two runs, with a fresh process on a persisted store', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-globs-'));
    const write = (f: string) => {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), `# ${f}\n`);
    };
    write('decisions/sre/adr/0001-a.md');
    write('src-checkout/adr/0001-b.md');
    write('src-checkout/adr/0002-c.md');
    const make = () =>
      globs([
        { base: path.join(root, 'decisions'), pattern: '**/*.md' },
        { base: path.join(root, 'src-checkout'), pattern: '**/*.md', generateId: ({ entry }) => `checkout/${entry.replace(/\.md$/, '')}` },
      ]);
    const { ctx, entries } = context(root);
    await make().load(ctx);
    expect(entries.size).toBe(3);

    fs.rmSync(path.join(root, 'src-checkout/adr/0002-c.md'));
    fs.rmSync(path.join(root, 'decisions/sre/adr/0001-a.md'));
    await make().load(ctx);
    expect([...entries.keys()]).toEqual(['checkout/adr/0001-b']);
  });
});
