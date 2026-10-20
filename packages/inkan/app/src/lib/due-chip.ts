import { dTag, dueText } from './dates';
import { t } from './i18n';

/**
 * Fills a review-due chip: the short `D-n` tag for the eye, `dueText` ("in 19 days", "9 days late") for screen
 * readers, and the word "overdue" on a late chip so lateness is not shown by colour alone.
 */
export function fillDueChip(chip: HTMLElement, days: number): void {
  const late = days < 0;
  const tag = document.createElement('span');
  tag.setAttribute('aria-hidden', 'true');
  tag.textContent = late ? `${dTag(days)} · ${t('reviews.overdue').toLowerCase()}` : dTag(days);
  const text = document.createElement('span');
  text.className = 'sr-only';
  text.textContent = dueText(days);
  chip.replaceChildren(tag, text);
  chip.classList.toggle('is-late', late);
  chip.hidden = false;
}
