/**
 * inkan sync: fetches the records of every `repo` source into node_modules/.inkan/sources/<project>.
 * `dir` sources need no fetching and are listed as-is. `dev` and `build` run this on their own when needed.
 */
import path from 'node:path';
import { loadConfig } from '../config.mjs';
import { markdownFiles } from '../records.mjs';
import { syncSources } from '../sources.mjs';
import { plural } from '../text.mjs';

export async function run({ root }) {
  const config = await loadConfig(root);
  if (config.sources.length === 0) {
    console.log('sync: no sources configured (see `sources` in inkan.config).');
    return 0;
  }
  await syncSources(config);
  for (const s of config.sources.filter((s) => s.dir)) {
    const count = markdownFiles(s.contentDir).length;
    console.log(`sync: ${s.project} ← ${path.relative(root, s.contentDir) || '.'} (local): ${plural(count, 'record')}`);
  }
  return 0;
}
