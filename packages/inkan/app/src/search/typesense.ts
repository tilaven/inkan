import { toHit, type SearchRecord } from './record';
import { requestJson } from './request';
import type { SearchHit, SearchProviderFactory } from './types';

export interface TypesenseOptions {
  host: string;
  apiKey: string;
  collection: string;
  queryBy?: string;
  params?: Record<string, string | number | boolean>;
}

interface TypesenseHighlight {
  field: string;
  snippet?: string;
}

interface TypesenseResponse {
  found?: number;
  hits: { document: Partial<SearchRecord> & Record<string, unknown>; highlights?: TypesenseHighlight[] }[];
}

const marked = (highlights: TypesenseHighlight[] | undefined, field: string) => {
  const snippet = highlights?.find((h) => h.field === field)?.snippet;
  return snippet?.includes('<mark>') ? snippet : undefined;
};

const typesense: SearchProviderFactory<TypesenseOptions> = ({
  host,
  apiKey,
  collection,
  queryBy = 'title,description,content,tags',
  params,
}) => ({
  async search(query, { limit, signal }) {
    const search = new URLSearchParams({
      q: query,
      query_by: queryBy,
      per_page: String(limit),
      highlight_start_tag: '<mark>',
      highlight_end_tag: '</mark>',
    });
    for (const [key, value] of Object.entries(params ?? {})) search.set(key, String(value));
    const data = await requestJson<TypesenseResponse>(
      'Typesense',
      `${host.replace(/\/+$/, '')}/collections/${encodeURIComponent(collection)}/documents/search?${search}`,
      { headers: { 'X-TYPESENSE-API-KEY': apiKey }, signal },
      '`host`, `apiKey` and `collection`',
    );
    const hits: SearchHit[] = data.hits.map(({ document, highlights }) =>
      toHit(document, marked(highlights, 'content') ?? marked(highlights, 'description')),
    );
    return { hits, total: data.found ?? hits.length };
  },
});

export default typesense;
