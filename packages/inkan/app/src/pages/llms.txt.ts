import type { APIRoute } from 'astro';
import { llmsIndex } from '../lib/ai';

export const GET: APIRoute = async () =>
  new Response(await llmsIndex(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
