import type { APIRoute, GetStaticPaths } from 'astro';
import { ogEnabled, projectCards, recordCards, renderOg, siteCard, warmOg } from '../../lib/og-data';

/** Open Graph cards: /og/<record id>.png, /og/<project>.png for team pages and /og/index.png for everything else. */
export const getStaticPaths: GetStaticPaths = async () => {
  if (!ogEnabled) return [];
  const projects = await projectCards();
  if (projects.some((p) => p.id === 'index')) console.warn('inkan: the project "index" shares /og/index.png with the site, so its team page shows the site card');
  const cards = [...(await recordCards()), ...projects.filter((p) => p.id !== 'index'), { id: 'index', card: await siteCard() }];
  if (import.meta.env.PROD) warmOg(cards.map((c) => c.card));
  return cards.map(({ id, card }) => ({ params: { slug: id }, props: { card } }));
};

export const GET: APIRoute = async ({ props }) => new Response(new Uint8Array(await renderOg(props.card)), { headers: { 'Content-Type': 'image/png' } });
