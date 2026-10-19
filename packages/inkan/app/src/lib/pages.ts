/** The user's own Markdown pages from `pagesDir`; `.astro` pages are injected as routes by astro.config.mjs. */
import { getCollection, type CollectionEntry } from 'astro:content';
import { hidden } from './auth';
import { site } from './config';

export type PageEntry = CollectionEntry<'pages'>;

export async function getPages(): Promise<PageEntry[]> {
  if (!site.pages.some((p) => p.kind === 'markdown')) return [];
  return getCollection('pages', (e) => !(import.meta.env.PROD && e.data.draft) && !hidden(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${e.id}/`));
}

/** `getStaticPaths` entries that render user pages through the docs route. */
export async function pagePaths() {
  return (await getPages()).map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
