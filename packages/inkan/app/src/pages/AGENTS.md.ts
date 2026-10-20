import type { APIRoute } from 'astro';
import fs from 'node:fs';
import { site } from '../lib/config';
import { agentsFile } from '../lib/home';

/** How to query this site through MCP instead of reading llms-full.txt; appended to the served file. */
const mcpNote = () =>
  `\n\n## MCP\nQuery these records with filters through the MCP server: \`npx @tilaven/inkan mcp --url ${site.url}\` ` +
  '(tools: search_records, get_record, list_projects, list_tags, list_fields, list_authors; resources: decision://<id>).\n';

/** Serves the repo's AGENTS.md (content folder or site root) so agents can fetch it next to llms.txt. */
export const GET: APIRoute = () => {
  const file = agentsFile();
  if (!file) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(file, 'utf8').trimEnd() + mcpNote(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
