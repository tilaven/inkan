import type { APIRoute } from 'astro';
import { searchRecords } from '../lib/search-index';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await searchRecords()), { headers: { 'Content-Type': 'application/json' } });
