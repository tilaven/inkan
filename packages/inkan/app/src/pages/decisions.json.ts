import type { APIRoute } from 'astro';
import { decisionsJson } from '../lib/ai';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await decisionsJson(), null, 2), { headers: { 'Content-Type': 'application/json' } });
