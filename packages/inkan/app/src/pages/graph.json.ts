import type { APIRoute } from 'astro';
import { getDecisions } from '../lib/decisions';
import { buildGraph } from '../lib/graph';

export const GET: APIRoute = async () => {
  const { nodes, edges, dangling } = buildGraph(await getDecisions());
  return new Response(JSON.stringify({ nodes, edges, dangling }, null, 2), { headers: { 'Content-Type': 'application/json' } });
};
