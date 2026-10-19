import { toHit, type SearchRecord } from './record';
import { requestJson } from './request';
import type { SearchHit, SearchProviderFactory } from './types';

export interface MeilisearchOptions {
  host: string;
  apiKey?: string;
  indexUid: string;
  params?: Record<string, unknown>;
}

type MeilisearchHit = Partial<SearchRecord> &
  Record<string, unknown> & { _formatted?: { content?: string; description?: string } };

interface MeilisearchResponse {
  hits: MeilisearchHit[];
  estimatedTotalHits?: number;
  totalHits?: number;
}

const marked = (html?: string) => (html?.includes('<mark>') ? html : undefined);

const meilisearch: SearchProviderFactory<MeilisearchOptions> = ({ host, apiKey, indexUid, params }) => ({
  async search(query, { limit, signal }) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const data = await requestJson<MeilisearchResponse>(
      'Meilisearch',
      `${host.replace(/\/+$/, '')}/indexes/${encodeURIComponent(indexUid)}/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          q: query,
          limit,
          attributesToCrop: ['content'],
          cropLength: 24,
          attributesToHighlight: ['content', 'description'],
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
          ...params,
        }),
        signal,
      },
      '`host`, `apiKey` and `indexUid`',
    );
    const hits: SearchHit[] = data.hits.map((hit) =>
      toHit(hit, marked(hit._formatted?.content) ?? marked(hit._formatted?.description)),
    );
    return { hits, total: data.estimatedTotalHits ?? data.totalHits ?? hits.length };
  },
});

export default meilisearch;
