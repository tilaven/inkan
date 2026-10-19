import { t } from '../lib/i18n';
import { SearchUnavailableError, type SearchHit, type SearchProviderFactory } from './types';

export interface PagefindOptions {
  ranking?: { termFrequency?: number; pageLength?: number; termSimilarity?: number; termSaturation?: number };
}

interface PagefindResult {
  data(): Promise<{
    url: string;
    excerpt: string;
    meta: Record<string, string | undefined>;
    filters: Record<string, string[] | undefined>;
  }>;
}

interface Pagefind {
  options(options: { baseUrl: string; ranking?: PagefindOptions['ranking'] }): Promise<void>;
  search(query: string): Promise<{ results: PagefindResult[] } | null>;
}

async function toHit(result: PagefindResult): Promise<SearchHit> {
  const { url, excerpt, meta, filters } = await result.data();
  return {
    url,
    title: meta.title ?? url,
    excerpt,
    marked: true,
    project: filters.project?.[0] ?? meta.project,
    type: meta.type ?? filters.type?.[0],
    status: meta.status,
    ref: meta.ref,
  };
}

const pagefind: SearchProviderFactory<PagefindOptions> = ({ ranking }) => {
  let loading: Promise<Pagefind> | undefined;

  const open = async (base: string) => {
    const pf: Pagefind = await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`);
    await pf.options({ baseUrl: base, ...(ranking && { ranking }) });
    return pf;
  };

  const load = async (base: string) => {
    try {
      return await (loading ??= open(base));
    } catch {
      loading = undefined;
      throw new SearchUnavailableError(t('search.needsBuild'));
    }
  };

  return {
    preload: ({ base }) => load(base).then(() => undefined, () => undefined),
    async search(query, { base, limit, signal }) {
      const pf = await load(base);
      const search = await pf.search(query);
      signal.throwIfAborted();
      const results = search?.results ?? [];
      return { hits: await Promise.all(results.slice(0, limit).map(toHit)), total: results.length };
    },
  };
};

export default pagefind;
