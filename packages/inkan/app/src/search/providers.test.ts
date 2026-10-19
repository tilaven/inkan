import { afterEach, describe, expect, it, vi } from 'vitest';
import algolia from './algolia';
import meilisearch from './meilisearch';
import typesense from './typesense';
import { SearchUnavailableError, type SearchProvider } from './types';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => fetchMock.mockReset());

const reply = (body: unknown, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
const ctx = () => ({ limit: 5, signal: new AbortController().signal, base: '/' });
const call = () => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body ?? 'null')) };
};

const doc = { url: '/sre/adr/1/', title: 'Use SLOs', description: 'Why SLOs', project: 'sre', type: 'adr', status: 'accepted', ref: 'SRE-ADR-0001' };
const expectedHit = (excerpt: string, marked?: boolean) => ({
  url: '/sre/adr/1/',
  title: 'Use SLOs',
  excerpt,
  ...(marked ? { marked } : {}),
  project: 'sre',
  type: 'adr',
  status: 'accepted',
  ref: 'SRE-ADR-0001',
});

const providers: [string, SearchProvider, string][] = [
  ['Algolia', algolia({ appId: 'APP', apiKey: 'key', indexName: 'dh' }), 'Algolia answered 403.'],
  ['Meilisearch', meilisearch({ host: 'http://ms:7700', indexUid: 'dh' }), 'Meilisearch answered 403.'],
  ['Typesense', typesense({ host: 'http://ts:8108', apiKey: 'key', collection: 'dh' }), 'Typesense answered 403.'],
];

describe.each(providers)('%s errors', (_name, provider, message) => {
  it('throws SearchUnavailableError on a non-2xx answer', async () => {
    reply({}, 403);
    const error = await provider.search('slo', ctx()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchUnavailableError);
    expect((error as Error).message).toContain(message);
  });

  it('throws SearchUnavailableError when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(provider.search('slo', ctx())).rejects.toBeInstanceOf(SearchUnavailableError);
  });

  it('lets AbortError through', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    fetchMock.mockRejectedValue(abort);
    await expect(provider.search('slo', ctx())).rejects.toBe(abort);
  });
});

describe('algolia', () => {
  it('queries the index and maps snippets', async () => {
    reply({
      nbHits: 12,
      hits: [
        { ...doc, _snippetResult: { content: { value: 'we <mark>slo</mark>' } } },
        { ...doc, _snippetResult: { content: { value: 'no match' }, description: { value: '<mark>Why</mark>' } } },
      ],
    });
    const result = await algolia({ appId: 'APP', apiKey: 'key', indexName: 'my index', params: { filters: 'type:adr' } }).search('slo', ctx());
    const { url, init, headers, body } = call();
    expect(url).toBe('https://APP-dsn.algolia.net/1/indexes/my%20index/query');
    expect(init.method).toBe('POST');
    expect(headers).toMatchObject({ 'X-Algolia-Application-Id': 'APP', 'X-Algolia-API-Key': 'key' });
    expect(body).toMatchObject({ query: 'slo', hitsPerPage: 5, attributesToSnippet: ['content:24'], highlightPreTag: '<mark>', highlightPostTag: '</mark>', filters: 'type:adr' });
    expect(result.total).toBe(12);
    expect(result.hits).toEqual([expectedHit('we <mark>slo</mark>', true), expectedHit('<mark>Why</mark>', true)]);
  });
});

describe('meilisearch', () => {
  it('searches with a bearer token and maps formatted fields', async () => {
    reply({
      estimatedTotalHits: 7,
      hits: [
        { ...doc, _formatted: { content: '<mark>slo</mark>s', description: 'Why SLOs' } },
        { ...doc, _formatted: { content: 'plain', description: 'Why <mark>SLOs</mark>' } },
        { ...doc, _formatted: { content: 'plain', description: 'Why SLOs' } },
      ],
    });
    const result = await meilisearch({ host: 'http://ms:7700/', apiKey: 'k', indexUid: 'dh', params: { matchingStrategy: 'all' } }).search('slo', ctx());
    const { url, headers, body } = call();
    expect(url).toBe('http://ms:7700/indexes/dh/search');
    expect(headers.Authorization).toBe('Bearer k');
    expect(body).toMatchObject({ q: 'slo', limit: 5, attributesToCrop: ['content'], cropLength: 24, attributesToHighlight: ['content', 'description'], highlightPreTag: '<mark>', highlightPostTag: '</mark>', matchingStrategy: 'all' });
    expect(result.total).toBe(7);
    expect(result.hits).toEqual([expectedHit('<mark>slo</mark>s', true), expectedHit('Why <mark>SLOs</mark>', true), expectedHit('Why SLOs')]);
  });

  it('omits Authorization without a key and falls back to the hit count', async () => {
    reply({ hits: [doc] });
    const result = await meilisearch({ host: 'http://ms:7700', indexUid: 'dh' }).search('slo', ctx());
    expect(call().headers.Authorization).toBeUndefined();
    expect(result.total).toBe(1);
  });
});

describe('typesense', () => {
  it('searches and maps highlights', async () => {
    reply({
      found: 3,
      hits: [
        { document: doc, highlights: [{ field: 'title', snippet: 'x' }, { field: 'content', snippet: 'we <mark>slo</mark>' }] },
        { document: doc, highlights: [{ field: 'description', snippet: '<mark>Why</mark>' }] },
        { document: doc },
      ],
    });
    const result = await typesense({ host: 'http://ts:8108', apiKey: 'key', collection: 'dh', params: { num_typos: 1 } }).search('slo', ctx());
    const { url, headers } = call();
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe('http://ts:8108/collections/dh/documents/search');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      q: 'slo',
      query_by: 'title,description,content,tags',
      per_page: '5',
      highlight_start_tag: '<mark>',
      highlight_end_tag: '</mark>',
      num_typos: '1',
    });
    expect(headers['X-TYPESENSE-API-KEY']).toBe('key');
    expect(result.total).toBe(3);
    expect(result.hits).toEqual([expectedHit('we <mark>slo</mark>', true), expectedHit('<mark>Why</mark>', true), expectedHit('Why SLOs')]);
  });
});
