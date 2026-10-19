import { toHit, type SearchRecord } from './record';
import { requestJson } from './request';
import type { SearchHit, SearchProviderFactory } from './types';

export interface AlgoliaOptions {
  appId: string;
  apiKey: string;
  indexName: string;
  params?: Record<string, unknown>;
}

type Snippet = { value?: string };

type AlgoliaHit = Partial<SearchRecord> &
  Record<string, unknown> & { _snippetResult?: { content?: Snippet; description?: Snippet } };

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits?: number;
}

const marked = (snippet?: Snippet) => (snippet?.value?.includes('<mark>') ? snippet.value : undefined);

const algolia: SearchProviderFactory<AlgoliaOptions> = ({ appId, apiKey, indexName, params }) => ({
  async search(query, { limit, signal }) {
    const data = await requestJson<AlgoliaResponse>(
      'Algolia',
      `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`,
      {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': appId,
          'X-Algolia-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          hitsPerPage: limit,
          attributesToSnippet: ['content:24'],
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
          ...params,
        }),
        signal,
      },
      '`appId`, `apiKey` and `indexName`',
    );
    const hits: SearchHit[] = data.hits.map((hit) =>
      toHit(hit, marked(hit._snippetResult?.content) ?? marked(hit._snippetResult?.description)),
    );
    return { hits, total: data.nbHits ?? hits.length };
  },
});

export default algolia;
