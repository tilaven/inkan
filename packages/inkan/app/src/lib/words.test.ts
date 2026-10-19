import { describe, expect, it } from 'vitest';
import { sameWord, teamWords } from './words';

describe('teamWords', () => {
  it('splits ids, names and camelCase', () => {
    expect(teamWords('payments-core')).toEqual(['payments', 'core']);
    expect(teamWords('SecurityTools')).toEqual(['security', 'tools']);
    expect(teamWords('iOS')).toEqual(['ios']);
    expect(teamWords('eCommerce iPhone')).toEqual(['ecommerce', 'iphone']);
    expect(teamWords('ML2Platform dataAPI')).toEqual(['ml2', 'platform', 'data', 'api']);
    expect(teamWords('ML Platform / v2')).toEqual(['ml', 'platform', 'v2']);
  });
});

describe('sameWord', () => {
  it('ignores a plural s', () => {
    expect(sameWord('payment', 'payments')).toBe(true);
    expect(sameWord('orders', 'order')).toBe(true);
    expect(sameWord('ops', 'sre')).toBe(false);
  });
});
