/**
 * inkan mcp [--root dir] [--url https://site]
 * MCP server over stdio: tools and resources for AI agents to query the records. Only protocol messages go to stdout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, packageDir } from '../config.mjs';
import { createServer, serveStdio } from '../mcp/server.mjs';
import { localSource, remoteSource } from '../mcp/source.mjs';
import { syncSources } from '../sources.mjs';

export async function run({ flags, root }) {
  if (flags.url !== undefined && (flags.url === true || !/^https?:\/\//.test(flags.url))) {
    throw new Error('--url must be the address of a published site, e.g. --url https://decisions.example.com');
  }
  const log = (line) => process.stderr.write(`inkan mcp: ${line}\n`);
  // Anything a plugin hook prints must not corrupt the stream on stdout.
  console.log = console.info = console.debug = (...a) => console.error(...a);
  const source = flags.url ? remoteSource(flags.url) : localSource(root);
  if (!flags.url) {
    // Source repos missing from the cache would otherwise show up as no records at all.
    try {
      await syncSources(await loadConfig(root, { warn: log }), { missingOnly: true, log });
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    }
    await source.projects(); // fail early on a broken config
  }
  const { version } = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  await serveStdio(createServer({ source, version, log }));
  return 0;
}
