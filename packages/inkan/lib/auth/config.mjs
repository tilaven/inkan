import { z } from 'astro/zod';

const common = {
  clientId: z.string().min(1),
  scopes: z.array(z.string().min(1)).optional(),
  /** Who may sign in; any match lets the user in, no lists at all lets every signed-in user in. */
  allow: z
    .object({
      emails: z.array(z.string().min(1)).optional(),
      domains: z.array(z.string().min(1)).optional(),
      groups: z.array(z.string().min(1)).optional(),
    })
    .strict()
    .optional(),
  /**
   * Count e-mail and domain rules even when the provider does not say whether the address is verified
   * (an address it flags as unverified still never counts).
   */
  trustEmail: z.boolean().optional(),
  /** Session length in seconds. */
  maxAge: z.number().int().min(60).optional(),
  redirectToAfterSignIn: z.string().startsWith('/').optional(),
  redirectToAfterSignOut: z.string().startsWith('/').optional(),
};
const httpsUrl = z.url({ protocol: /^https?$/ });

export const authenticationSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ ...common, type: z.literal('openid'), issuer: httpsUrl, groupsClaim: z.string().min(1).optional() }).strict(),
    z.object({ ...common, type: z.literal('auth0'), domain: z.string().min(1), groupsClaim: z.string().min(1).optional() }).strict(),
    z.object({ ...common, type: z.literal('entra'), tenantId: z.string().min(1) }).strict(),
    z.object({ ...common, type: z.literal('gitlab'), url: httpsUrl.optional() }).strict(),
    z.object({ ...common, type: z.literal('github'), url: httpsUrl.optional() }).strict(),
  ],
  { error: 'type must be one of openid, auth0, entra, gitlab, github' },
);

export const protectedRoutesSchema = z.array(z.string().startsWith('/', 'must start with "/"'));

/** Defaults of the resolved `authentication` option (secrets never live here: they come from the environment). */
export function resolveAuthentication(auth) {
  if (!auth) return null;
  const out = { scopes: undefined, allow: {}, maxAge: 8 * 60 * 60, ...auth };
  const oidc = ['openid', 'email', 'profile'];
  if (out.type === 'auth0') {
    out.issuer = `https://${out.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/`;
  } else if (out.type === 'entra') {
    out.issuer = `https://login.microsoftonline.com/${out.tenantId}/v2.0`;
  } else if (out.type === 'gitlab') {
    out.issuer = (out.url ?? 'https://gitlab.com').replace(/\/+$/, '');
    out.groupsClaim = 'groups_direct';
  } else if (out.type === 'github') {
    out.url = (out.url ?? 'https://github.com').replace(/\/+$/, '');
  }
  out.groupsClaim ??= 'groups';
  out.scopes ??= out.type === 'github' ? ['read:user', 'user:email', ...(out.allow.groups?.length ? ['read:org'] : [])] : oidc;
  return out;
}
