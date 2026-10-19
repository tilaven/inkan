import type { APIRoute } from 'astro';
import { getDocs } from '../lib/decisions';
import { getPages } from '../lib/pages';
import { rawMarkdown } from '../lib/markdown';

export async function getStaticPaths() {
  const entries = [...(await getDocs()), ...(await getPages())];
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(rawMarkdown(props.entry), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
