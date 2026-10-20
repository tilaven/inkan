import en from './en.mjs';

const rules = new Intl.PluralRules('en');

/**
 * Interface text for `key`. `{name}` placeholders take `params.name`; a plural message (`{ one, other }`)
 * picks its form by `params.count`. Unknown keys render as the key itself.
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 */
export function t(key, params = {}) {
  const message = en[key] ?? key;
  const text = typeof message === 'string' ? message : (message[rules.select(Number(params.count ?? 0))] ?? message.other ?? key);
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}
