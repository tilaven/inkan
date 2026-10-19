import { describe, expect, it } from 'vitest';
import { DEADLINE_SOON, daysBetween, daysUntil, isoDay, today, urgency } from './calendar.mjs';

describe('isoDay', () => {
  it('is the local calendar day whatever the time of day', () => {
    expect(isoDay(new Date(2026, 9, 18, 0, 30))).toBe('2026-10-18');
    expect(isoDay(new Date(2026, 9, 18, 23, 59, 59))).toBe('2026-10-18');
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('is what today() returns', () => {
    expect(today()).toBe(isoDay(new Date()));
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('daysBetween', () => {
  it('counts calendar days, negative when past', () => {
    expect(daysBetween('2026-10-17', '2026-10-17')).toBe(0);
    expect(daysBetween('2026-10-17', '2026-10-20')).toBe(3);
    expect(daysBetween('2026-10-17', '2026-10-10')).toBe(-7);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('daysUntil', () => {
  const today = new Date(2026, 9, 15, 23, 59);

  it('counts calendar days from a local date regardless of the time of day', () => {
    expect(daysUntil('2026-10-15', today)).toBe(0);
    expect(daysUntil('2026-10-16', today)).toBe(1);
    expect(daysUntil('2026-10-08', today)).toBe(-7);
    expect(daysUntil('2027-01-01', today)).toBe(78);
    expect(daysUntil('2026-10-18', new Date(2026, 9, 18, 0, 30))).toBe(0);
  });

  it('crosses DST changes without drifting', () => {
    expect(daysUntil('2026-11-02', new Date(2026, 9, 25, 12))).toBe(8);
    expect(daysUntil('2026-04-01', new Date(2026, 2, 25, 0, 30))).toBe(7);
  });
});

describe('urgency', () => {
  it('buckets by days left with an explicit window', () => {
    expect([-1, 0, 30, 31].map((d) => urgency(d, 30))).toEqual(['overdue', 'soon', 'soon', 'later']);
    expect([-1, 0, 7, 8].map((d) => urgency(d, DEADLINE_SOON))).toEqual(['overdue', 'soon', 'soon', 'later']);
    expect(urgency(10, 7)).toBe('later');
  });
});
