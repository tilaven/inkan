/** Interface text. Safe to import from browser scripts. */
import { t as text } from '../../../lib/i18n/index.mjs';
import type en from '../../../lib/i18n/en.mjs';

export type MessageKey = keyof typeof en;

/** `t('filters.count', { count: 3 })`; `{name}` placeholders take `params.name`. */
export const t = (key: MessageKey, params?: Record<string, string | number>): string => text(key, params);

/** Words for a yes/no field value. */
export const yesNo = { yes: t('field.yes'), no: t('field.no') };
