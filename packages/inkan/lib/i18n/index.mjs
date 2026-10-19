import en from './en.mjs';
import pl from './pl.mjs';

/** Interface languages shipped with the package. Any other locale works with `translations`; missing keys fall back to English. */
export const builtinMessages = { en, pl };

/** @typedef {string | Partial<Record<Intl.LDMLPluralRule, string>>} Message */
/** @typedef {Record<string, Message>} Messages */

/** `pl-PL` → `['pl-PL', 'pl']`. */
const chain = (locale) => {
  const parts = locale.split('-');
  return parts.map((_, i) => parts.slice(0, parts.length - i).join('-'));
};

/**
 * The messages for `locale`: English, then the built-in language, then each layer's `translations`
 * (plugins first, the user's config last), each overriding the one before.
 * @param {string} locale
 * @param {Record<string, Messages>[]} layers
 * @returns {Messages}
 */
export function resolveMessages(locale, layers = []) {
  const langs = chain(locale).reverse();
  const out = { ...en };
  for (const lang of langs) Object.assign(out, builtinMessages[lang]);
  for (const layer of layers) for (const lang of langs) Object.assign(out, layer?.[lang]);
  return out;
}

/**
 * A `t(key, params)` bound to `messages`. `{name}` placeholders take `params.name`; a plural message
 * (`{ one, few, many, other }`) picks its form by `params.count`. Unknown keys render as the key itself.
 * @param {string} locale
 * @param {Messages} messages
 */
export function translator(locale, messages) {
  const rules = new Intl.PluralRules(locale);
  /** @param {string} key @param {Record<string, string | number>} [params] */
  return (key, params = {}) => {
    const message = messages[key] ?? key;
    const text = typeof message === 'string' ? message : (message[rules.select(Number(params.count ?? 0))] ?? message.other ?? key);
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  };
}

const actionKeys = { '/decisions/': 'landing.browse', '/timeline/': 'nav.timeline', '/backlog/': 'nav.backlog' };

/**
 * Defaults whose text the reader sees (status and type labels, tagline, landing buttons) in the site's language.
 * @template {typeof import('../defaults.mjs').defaults} D
 * @param {D} defaults
 * @param {(key: string) => string} t
 * @returns {D}
 */
export function localizeDefaults(defaults, t) {
  const out = structuredClone(defaults);
  out.tagline = t('site.tagline');
  out.description = t('site.description');
  for (const [id, s] of Object.entries(out.statuses)) s.label = t(`status.${id}`);
  for (const [id, d] of Object.entries(out.docTypes)) {
    d.plural = t(`docType.${id}.plural`);
    d.description = t(`docType.${id}.description`);
  }
  out.landing.actions = out.landing.actions.map((a) => ({ ...a, text: actionKeys[a.link] ? t(actionKeys[a.link]) : a.text }));
  return out;
}
