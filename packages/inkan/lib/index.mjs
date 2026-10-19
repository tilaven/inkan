/** Identity helper that gives editors type hints for inkan.config.ts. */
export function defineConfig(config) {
  return config;
}

/** Identity helper that gives editors type hints for a plugin. */
export function definePlugin(plugin) {
  return plugin;
}

/**
 * Types a cover motif (`export default defineMotif((c, r, p) => { ... }, { keywords: ['security'] })`).
 * Projects whose id or name contains one of the `keywords` get this motif when they do not pin one.
 * @template {Function} F
 * @param {F} fn
 * @param {{ keywords?: readonly string[] }} [options]
 */
export function defineMotif(fn, { keywords } = {}) {
  if (keywords === undefined) return fn;
  if (!Array.isArray(keywords) || keywords.some((k) => typeof k !== 'string')) {
    throw new TypeError('inkan: defineMotif keywords must be an array of strings');
  }
  return Object.assign(fn, { keywords });
}
