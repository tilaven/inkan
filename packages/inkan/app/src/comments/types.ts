import type { Decision } from '../lib/decisions';

/** Props of a comments provider component (`app/src/comments/<provider>.astro` or `comments.component`). */
export interface CommentsProps {
  d: Decision;
  /** The provider's resolved options; for `custom`, `comments.options`. */
  options: Record<string, unknown>;
  /** Front-matter `discussion`: where the conversation lives, if it is set. */
  discussion?: string;
  /** `SRE-RFC-0001 Error budget policy`, or the title alone for records without a number. */
  title: string;
  /** Absolute URL of the record page. */
  pageUrl: string;
}
