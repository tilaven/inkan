import type { APIRoute, GetStaticPaths } from 'astro';
import { badgeJson } from '../../lib/badge';
import { getBadges } from '../../lib/badge-data';

/** The same badges as shields.io endpoint JSON: https://img.shields.io/endpoint?url=<site>/badges/records.json */
export const getStaticPaths: GetStaticPaths = async () => (await getBadges()).map((badge) => ({ params: { name: badge.name }, props: { badge } }));

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(badgeJson(props.badge)), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=300' } });
