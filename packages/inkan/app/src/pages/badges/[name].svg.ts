import type { APIRoute, GetStaticPaths } from 'astro';
import { badgeSvg } from '../../lib/badge';
import { getBadges } from '../../lib/badge-data';

/** README badges: /badges/records.svg, /badges/accepted.svg and /badges/<project>.svg. */
export const getStaticPaths: GetStaticPaths = async () => (await getBadges()).map((badge) => ({ params: { name: badge.name }, props: { badge } }));

export const GET: APIRoute = ({ props }) =>
  new Response(badgeSvg(props.badge), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'max-age=300' } });
