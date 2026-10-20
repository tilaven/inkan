import { describe, expect, it } from 'vitest';
import { t } from '../lib/i18n/index.mjs';

describe('t', () => {
  it('picks the plural form by count', () => {
    expect([0, 1, 2].map((count) => t('filters.count', { count }))).toEqual(['0 records', '1 record', '2 records']);
  });

  it('fills placeholders and keeps unknown ones and unknown keys', () => {
    expect(t('markdown.inRecord', { label: 'Table 1', title: 'SLOs' })).toBe('Table 1 in SLOs');
    expect(t('markdown.inRecord', { label: 'Table 1' })).toBe('Table 1 in {title}');
    expect(t('missing.key')).toBe('missing.key');
  });
});
