import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Motif names: lowercase, digits and dashes, starting with a letter. */
export const MOTIF_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * Motifs registered by plugins, with `entrypoint` as an absolute path. A later plugin wins over an earlier one
 * (and over a built-in motif of the same name).
 * @param {{ name: string, motifs?: Record<string, string | URL> }[]} plugins
 * @returns {{ name: string, entrypoint: string, plugin: string }[]}
 */
export function pluginMotifs(plugins) {
  const motifs = new Map();
  for (const p of plugins) {
    for (const [name, raw] of Object.entries(p.motifs ?? {})) {
      const url = raw instanceof URL ? raw : /^[a-z][a-z0-9+.-]*:\/\//i.test(String(raw)) ? new URL(String(raw)) : null;
      if (url && url.protocol !== 'file:') {
        throw new Error(`inkan: plugin "${p.name}" motif "${name}": expected a file path or file: URL, got ${url.href}`);
      }
      const entrypoint = url ? fileURLToPath(url) : path.resolve(String(raw));
      if (!fs.existsSync(entrypoint)) {
        throw new Error(`inkan: plugin "${p.name}" motif "${name}": module not found: ${entrypoint}`);
      }
      motifs.set(name, { name, entrypoint, plugin: p.name });
    }
  }
  return [...motifs.values()];
}
