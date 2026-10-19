/** Interface text in the site's language (`locale` in the config). Safe to import from browser scripts. */
import { locale, messages } from 'virtual:inkan/i18n';
import { translator } from '../../../lib/i18n/index.mjs';
import type en from '../../../lib/i18n/en.mjs';

export type MessageKey = keyof typeof en;

export { locale };

const translate = translator(locale, messages);

/** `t('filters.count', { count: 3 })`; `{name}` placeholders take `params.name`. */
export const t = (key: MessageKey, params?: Record<string, string | number>): string => translate(key, params);

/** Words for a yes/no field value. */
export const yesNo = { yes: t('field.yes'), no: t('field.no') };
