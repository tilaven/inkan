/**
 * Who may sign in. No lists at all lets every signed-in user in; otherwise any one match is enough.
 * Email rules only count for an address the identity provider confirmed as verified, unless `trustEmail`
 * says the provider's addresses are trustworthy as they are (it still never admits an address flagged as unverified).
 */
const lower = (list = []) => list.map((s) => s.toLowerCase());

/**
 * @param {{ email?: string | null, emailVerified?: boolean, groups?: string[] }} user
 * @param {{ emails?: string[], domains?: string[], groups?: string[] } | undefined} allow
 * @param {{ trustEmail?: boolean }} [options]
 */
export function isAllowed(user, allow, { trustEmail = false } = {}) {
  const emails = lower(allow?.emails);
  const domains = lower(allow?.domains);
  const groups = lower(allow?.groups);
  if (!emails.length && !domains.length && !groups.length) return true;
  const email = user.email?.toLowerCase();
  const verified = user.emailVerified === true || (trustEmail && user.emailVerified !== false);
  if (email && verified) {
    if (emails.includes(email)) return true;
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (domains.includes(domain)) return true;
  }
  return lower(user.groups).some((g) => groups.includes(g));
}
