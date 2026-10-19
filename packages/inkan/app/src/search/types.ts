export interface SearchHit {
  /** Link to the page, including the site's base path. */
  url: string;
  title: string;
  excerpt?: string;
  /** `excerpt` is HTML whose only markup is `<mark>` around matches. */
  marked?: boolean;
  /** Project id; the palette shows the project's name and ink. */
  project?: string;
  type?: string;
  /** Status id (`accepted`), never its label; the palette looks the sticker and the label up by it. */
  status?: string;
  ref?: string;
}

export interface SearchResults {
  hits: SearchHit[];
  /** Matches in the index, which may be more than `hits`. */
  total: number;
}

export interface SearchContext {
  /** Most hits the palette shows. */
  limit: number;
  /** Aborted when a newer query replaces this one. */
  signal: AbortSignal;
  /** The site's base path, ending in `/`. */
  base: string;
}

export interface SearchProvider {
  /** Called when the palette opens, so the first query is fast. */
  preload?(ctx: Pick<SearchContext, 'base'>): void | Promise<void>;
  search(query: string, ctx: SearchContext): Promise<SearchResults>;
}

export type SearchProviderFactory<Options = Record<string, unknown>> = (options: Options) => SearchProvider;

/** Thrown when the index cannot be reached; the palette shows the message, with `code` spans in backticks. */
export class SearchUnavailableError extends Error {
  override name = 'SearchUnavailableError';
}
