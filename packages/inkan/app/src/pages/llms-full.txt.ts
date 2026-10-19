import type { APIRoute } from 'astro';
import { llmsFull } from '../lib/ai';

export const GET: APIRoute = async () =>
  new Response(await llmsFull(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
