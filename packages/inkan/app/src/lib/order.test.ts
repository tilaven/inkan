import { describe, expect, it } from 'vitest';
import { recordOrder } from './order';

const rec = (id: string, number: number | null, date?: string) => ({ id, number, date: date ? new Date(`${date}T00:00:00Z`) : null });
const records = [
  rec('p/adr/0001-a', 1, '2026-01-10'),
  rec('p/adr/0002-b', 2, '2026-03-01'),
  rec('p/adr/0003-c', 3, '2026-03-01'),
  rec('p/adr/0004-d', 4),
  rec('p/adr/0005-e', 5, '2026-02-01'),
];
const ids = (sort: 'newest' | 'oldest' | 'number') => [...records].sort(recordOrder(sort)).map((r) => r.number);

describe('recordOrder', () => {
  it('puts the newest first, higher numbers first on the same day, undated last', () => {
    expect(ids('newest')).toEqual([3, 2, 5, 1, 4]);
  });
  it('puts the oldest first, lower numbers first on the same day, undated last', () => {
    expect(ids('oldest')).toEqual([1, 5, 2, 3, 4]);
  });
  it('keeps record number order', () => {
    expect(ids('number')).toEqual([1, 2, 3, 4, 5]);
  });
});
