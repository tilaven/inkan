/**
 * inkan check [--strict] [--format json]
 * Validates references, numbering, statuses, dates and project metadata. Exit 1 on errors
 * (with --strict also on warnings). On GitHub Actions every problem is also emitted as an annotation.
 */
import { checkSite, formatAnnotations, formatText, toJson } from '../check.mjs';
import { loadConfig } from '../config.mjs';
import { syncSources } from '../sources.mjs';

export async function run({ flags, root }) {
  const config = await loadConfig(root);
  await syncSources(config, { missingOnly: true, log: (line) => console.error(line) });
  const result = checkSite(config);
  const errors = result.problems.filter((p) => p.level === 'error').length;
  const failed = errors > 0 || (flags.strict && result.problems.length > 0);

  const paths = { root: config.root };
  if (flags.format === 'json') console.log(JSON.stringify(toJson(result, paths), null, 2));
  else console.log(formatText(result, paths));
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const line of formatAnnotations(result.problems, { workspace: process.env.GITHUB_WORKSPACE || config.repoRoot })) console.log(line);
  }
  return failed ? 1 : 0;
}
