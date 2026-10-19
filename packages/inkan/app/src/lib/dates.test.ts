import { describe, expect, it } from 'vitest';
import { DEADLINE_SOON, dTag, daysUntil, dueText, formatLongDate, overdueCount, stampDueRows, urgency } from './dates';

const today = new Date(2026, 9, 15, 23, 59);

/** The parts of a backlog row that `stampDueRows` touches. */
function fakeRow(reviewBy: string) {
  const classes = new Set<string>();
  const tag = { textContent: '' };
  const text = { textContent: '' };
  const row = {
    dataset: { reviewBy },
    classList: { add: (c: string) => classes.add(c), remove: (...cs: string[]) => cs.forEach((c) => classes.delete(c)) },
    querySelector: (sel: string) => (sel === '.bl__d b' ? tag : sel === '[data-due]' ? text : null),
  };
  return { row: row as unknown as HTMLElement, classes, tag, text };
}

describe('dates', () => {
  it('counts calendar days regardless of the time of day', () => {
    expect(daysUntil('2026-10-15', today)).toBe(0);
    expect(daysUntil('2026-10-16', today)).toBe(1);
    expect(daysUntil('2026-10-08', today)).toBe(-7);
  });

  it('formats the tag and the sentence through the dictionary', () => {
    expect([dTag(0), dTag(5), dTag(-2)]).toEqual(['D-DAY', 'D-5', 'D+2']);
    expect([dueText(0), dueText(1), dueText(9), dueText(-1), dueText(-4)]).toEqual([
      'today',
      'in 1 day',
      'in 9 days',
      '1 day late',
      '4 days late',
    ]);
  });

  it('classifies urgency with the deadline window', () => {
    expect([-1, 0, 7, 8].map((d) => urgency(d, DEADLINE_SOON))).toEqual(['overdue', 'soon', 'soon', 'later']);
  });

  it('counts the dates before today', () => {
    expect(overdueCount(['2026-10-14', '2026-10-15', '2026-10-16', '2025-01-01'], today)).toBe(2);
    expect(overdueCount([], today)).toBe(0);
  });

  it('stamps rows with their state, chip and sentence', () => {
    const late = fakeRow('2026-10-12');
    const due = fakeRow('2026-10-15');
    const soon = fakeRow('2026-10-20');
    const later = fakeRow('2026-11-30');
    late.classes.add('is-soon');
    const stamped = stampDueRows([late.row, due.row, soon.row, later.row], DEADLINE_SOON, today);
    expect(stamped.map((s) => [s.days, s.level])).toEqual([
      [-3, 'overdue'],
      [0, 'soon'],
      [5, 'soon'],
      [46, 'later'],
    ]);
    expect(stamped.map((s) => s.row)).toEqual([late.row, due.row, soon.row, later.row]);
    expect([late, due, soon, later].map((r) => [...r.classes])).toEqual([['is-overdue'], ['is-soon'], ['is-soon'], []]);
    expect([late, due, soon, later].map((r) => r.tag.textContent)).toEqual(['D+3', 'D-DAY', 'D-5', 'D-46']);
    expect([late, due, soon, later].map((r) => r.text.textContent)).toEqual(['3 days late', 'today', 'in 5 days', 'in 46 days']);
    expect(stampDueRows([soon.row], 30, today)[0]!.level).toBe('soon');
  });

  it('formats a long date', () => {
    expect(formatLongDate(new Date(2026, 9, 15))).toBe('15 Oct 2026');
  });
});
