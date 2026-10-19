import path from 'node:path';

/** Astro prefixes `base` to redirect sources but not to their targets, so site-relative targets get it here. */
export const withBase = (base, to) => (to.startsWith('/') && !to.startsWith('//') ? path.posix.join(base || '/', to) : to);

/** `config.redirects` ready for Astro: site-relative targets carry the base path, external URLs are untouched. */
export const resolveRedirects = (redirects, base) =>
  Object.fromEntries(Object.entries(redirects).map(([from, to]) => [from, withBase(base, to)]));
