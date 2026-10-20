import { describe, expect, it } from 'vitest';
import { defaults } from '../lib/defaults.mjs';
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

describe('default labels', () => {
  it('match the interface text', () => {
    expect(defaults.tagline).toBe(t('site.tagline'));
    expect(defaults.description).toBe(t('site.description'));
    for (const [id, s] of Object.entries(defaults.statuses)) expect(s.label, id).toBe(t(`status.${id}`));
    for (const [id, d] of Object.entries(defaults.docTypes)) expect([d.plural, d.description], id).toEqual([t(`docType.${id}.plural`), t(`docType.${id}.description`)]);
  });
});
