import { describe, expect, it } from 'vitest';
import { localSource, remoteSource } from '../lib/mcp/source.mjs';
import { listResources, readResource, tools } from '../lib/mcp/tools.mjs';
import { tmpSite } from './helpers.mjs';

const record = (title, extra = '') => `---\ntitle: ${title}\nstatus: proposed\n${extra}---\n\nBody.\n`;
const tool = (name) => tools.find((t) => t.name === name);

describe('mcp sources and tools', () => {
  it('local records point at their real file, also for slug records', async () => {
    const root = tmpSite({
      'decisions/sre/adr/0001-a.md': record('A', 'slug: pretty\n'),
    });
    const [r] = await localSource(root).records();
    expect(r.id).toBe('pretty');
    expect(r.source).toBe('decisions/sre/adr/0001-a.md');
  });

  const search = tools.find((t) => t.name === 'search_records');
  const mk = (n, body) => ({ id: `p/adr/${n}`, title: `T${n}`, description: null, tags: [], authors: [], status: 'live', project: 'p', type: 'adr', body });

  it('caps concurrent body fetches and matches index fields without fetching', async () => {
    let active = 0;
    let peak = 0;
    let fetched = 0;
    const body = (text) => async () => {
      fetched++;
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return text;
    };
    const records = [mk(0, body('x')), ...Array.from({ length: 40 }, (_, i) => mk(i + 1, body(i === 39 ? 'needle' : 'hay')))];
    records[0].title = 'needle title';
    const source = { records: async () => records, isCurrent: () => true };
    const res = await search.run({ query: 'needle' }, source);
    expect(res.records.map((r) => r.id)).toEqual(['p/adr/0', 'p/adr/40']);
    expect(peak).toBeLessThanOrEqual(8);
    expect(fetched).toBe(40);
  });

  it('round-trips resource URIs and survives a malformed %', async () => {
    const rec = { ...mk(1, async () => 'b'), id: 'p/adr/a b%c', ref: null, authors: [], deciders: [], supersedes: [], supersededBy: [], tags: [], date: null };
    const source = { records: async () => [rec] };
    const [res] = await listResources(source);
    expect(res.uri).toBe('decision://p/adr/a%20b%25c');
    expect((await readResource(source, res.uri))?.uri).toBe(res.uri);
    expect(await readResource(source, 'decision://p/adr/100%')).toBeUndefined();
  });
});

describe('mcp remote and local sources', () => {
  it('times out a stalled site', async () => {
    const stalled = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    const source = remoteSource('https://example.test', { timeout: 50, fetchImpl: stalled });
    await expect(source.records()).rejects.toThrow('did not answer within');
  });

  it('counts only published records per project and explains ambiguous ids', async () => {
    const rec = (title, extra = '') => `---\ntitle: ${title}\nstatus: accepted\n${extra}---\nBody\n`;
    const root = tmpSite({
      'decisions/sre/_project.yml': 'name: SRE\n',
      'decisions/sre/adr/0001-a.md': rec('A'),
      'decisions/sre/adr/0002-draft.md': rec('Draft', 'draft: true\n'),
      'decisions/ops/adr/0001-b.md': rec('B'),
    });
    const source = localSource(root);
    const sre = (await source.projects()).find((p) => p.id === 'sre');
    expect(sre.records).toBe(1);
    await expect(tool('get_record').run({ id: 'adr/0001-a' }, source)).resolves.toMatchObject({ id: 'sre/adr/0001-a' });
    const dup = tmpSite({ 'decisions/sre/adr/0001-a.md': rec('A'), 'decisions/sre/adr/0001-b.md': rec('B') });
    await expect(tool('get_record').run({ id: 'SRE-ADR-0001' }, localSource(dup))).rejects.toThrow('ambiguous');
  });
});
