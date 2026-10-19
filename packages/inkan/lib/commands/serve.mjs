/**
 * inkan serve [--port 8080] [--host 0.0.0.0] [--base /]
 * Production server for a built site: `dist/` as static files and, when `dist-protected/_server.json` exists
 * (the site was built with `authentication`), sign-in with the protected variant for signed-in users.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHandler } from '../auth/server.mjs';

export const PUBLIC_DIR = 'dist';
export const PROTECTED_DIR = 'dist-protected';
export const MANIFEST = '_server.json';

/** `dist-protected/_server.json`, or `null` when the site was built without authentication. */
export function readManifest(root) {
  const file = path.join(root, PROTECTED_DIR, MANIFEST);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

export async function run({ flags, root }) {
  const publicDir = path.join(root, PUBLIC_DIR);
  if (!fs.existsSync(path.join(publicDir, 'index.html'))) throw new Error(`No built site in ${publicDir}; run \`inkan build\` first`);
  const manifest = readManifest(root);
  const port = Number(flags.port ?? process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port "${flags.port ?? process.env.PORT}"`);
  const host = typeof flags.host === 'string' ? flags.host : '0.0.0.0';
  const handler = await createHandler({
    publicDir,
    protectedDir: path.join(root, PROTECTED_DIR),
    manifest,
    base: typeof flags.base === 'string' ? flags.base : process.env.BASE_PATH,
  });
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, host, () => resolve(undefined)));
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  const shown = ['0.0.0.0', '::'].includes(address.address) ? 'localhost' : address.address;
  console.log(`inkan serve: http://${shown.includes(':') ? `[${shown}]` : shown}:${address.port}${manifest ? ` (sign-in: ${manifest.authentication.type})` : ''}`);
  return new Promise((resolve) => {
    const stop = () => {
      server.close(() => resolve(0));
      server.closeAllConnections();
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  });
}
