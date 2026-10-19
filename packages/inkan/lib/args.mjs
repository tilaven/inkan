/** Flags that never take a value, so they cannot swallow the argument after them. */
export const BOOLEAN_FLAGS = new Set(['dry-run', 'strict', 'offline', 'pdf', 'no-build', 'public', 'help', 'all', 'json']);

/**
 * Splits argv into positional `args` and `--flag [value]` / `--flag=value` pairs. A flag takes the next argument as
 * its value unless it is a known boolean (or the next argument is another flag), in which case it is `true`.
 */
export function parseArgs(argv) {
  const flags = {};
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') || a === '--') {
      args.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (eq !== -1) flags[key] = a.slice(eq + 1);
    else if (!BOOLEAN_FLAGS.has(key) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { args, flags };
}
