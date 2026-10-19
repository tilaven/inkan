/**
 * `protectedRoutes` patterns: paths relative to `base`, where `*` matches anything (slashes included).
 * `/sre/*` covers `/sre/` and everything below it; case, a trailing slash and the `.md` copy of a page do not matter.
 */
const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

const normalize = (p) => {
  p = `/${p}`.replace(/\/{2,}/g, '/');
  if (p.endsWith('/index.md')) p = p.slice(0, -'index.md'.length);
  else if (p.endsWith('.md')) p = p.slice(0, -'.md'.length);
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

/** Regex for one pattern; `/a/*` also matches `/a` itself. */
export function routePattern(pattern) {
  const p = normalize(pattern.trim());
  const body = p.endsWith('/*') ? `${escape(p.slice(0, -2)).replaceAll('*', '.*')}(?:/.*)?` : escape(p).replaceAll('*', '.*');
  return new RegExp(`^${body}$`, 'i');
}

/**
 * `(pathname) => boolean` for a list of patterns. `pathname` may include `base` (it is stripped)
 * or be relative to it, and may be URL-encoded.
 */
export function routeMatcher(patterns = [], base = '/') {
  const regexes = patterns.map(routePattern);
  const prefix = base.replace(/\/+$/, '');
  return (pathname) => {
    if (!regexes.length) return false;
    let p = pathname;
    try {
      p = decodeURI(p);
    } catch {}
    if (prefix && (p === prefix || p.startsWith(`${prefix}/`))) p = p.slice(prefix.length);
    const n = normalize(p);
    return regexes.some((r) => r.test(n));
  };
}
