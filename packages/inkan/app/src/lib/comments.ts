export interface CommentsRule {
  enabled: boolean;
  provider: string | null;
  types: string[];
  statuses: string[] | null;
}

interface Commentable {
  type: string | null;
  status?: string;
  entry: { data: { comments?: boolean } };
}

/** Front matter decides first; otherwise the record's type and status must be listed. */
export function hasComments(d: Commentable, rule: CommentsRule) {
  if (!rule.enabled || !rule.provider) return false;
  const own = d.entry.data.comments;
  if (own !== undefined) return own;
  if (!d.type || !rule.types.includes(d.type)) return false;
  return !rule.statuses || (!!d.status && rule.statuses.includes(d.status));
}
