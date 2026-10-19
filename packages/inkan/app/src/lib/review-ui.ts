/** Wording and glyphs for the review UI, shared by the record header, cards and the RFC reviews page. */
import type { ReviewSummary } from '../../../lib/rfc-reviews.mjs';
import { t } from './i18n';

type State = ReviewSummary['reviewers'][number]['state'];

export const REVIEW_MARK: Record<State, string> = { approved: '✓', 'changes-requested': '✕', pending: '○' };
export const REVIEW_TEXT: Record<State, string> = { approved: t('review.approved'), 'changes-requested': t('review.changesRequested'), pending: t('review.pending') };

/** Whether a review is live: someone was asked and the record is still open. */
export const isLive = (r: ReviewSummary) => r.status !== 'none' && r.status !== 'closed';

/** `2 of 3 approvals`, `Changes requested`, `Approved`, `Review closed`. */
export function reviewText(r: ReviewSummary): string {
  switch (r.status) {
    case 'changes-requested':
      return REVIEW_TEXT['changes-requested'];
    case 'approved':
      return REVIEW_TEXT.approved;
    case 'closed':
      return t('review.closed');
    default:
      return t('review.progress', { approved: r.approved, count: r.required });
  }
}

/** Short form for tight spots: `2/3 ✓`, `changes requested`, `approved`. */
export function reviewChip(r: ReviewSummary): string {
  return r.status === 'in-review' ? `${r.approved}/${r.required} ${REVIEW_MARK.approved}` : r.status === 'changes-requested' ? t('review.chipChanges') : t('review.chipApproved');
}

/** State, date and note of one review, for a tooltip. */
export const reviewTitle = (r: ReviewSummary['reviewers'][number]) => [REVIEW_TEXT[r.state], r.date, r.note].filter(Boolean).join(' · ');
