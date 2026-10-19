/**
 * Sign-in aware helpers. With `authentication` configured the site is built twice: the `public` variant hides every
 * protected page, the `protected` variant shows all of them with a lock mark. Without it nothing is protected.
 */
import { protectedMatcher, protectedProjects } from '../../../lib/auth/protect.mjs';
import { site } from './config';
import { normalizeRef } from './graph';

export type Variant = 'public' | 'protected' | null;
export const variant: Variant = site.variant;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

let matcher: ((pathname: string) => boolean) | undefined;
/** True for a path (with or without base) only members may see: a protected project's, or one matching `protectedRoutes`. */
export function isProtectedPath(pathname: string): boolean {
  if (!variant) return false;
  // `_project.yml` files may change while the dev server runs.
  if (!matcher || !import.meta.env.PROD) matcher = protectedMatcher(site, protectedProjects(site));
  return matcher(pathname);
}

/** Left out of this build: protected and building the public site. */
export const hidden = (pathname: string) => variant === 'public' && isProtectedPath(pathname);

/** True for a `supersedes`/`related` reference, in any form an author may write it, to a record left out of this build. */
export const hiddenRef = (ref: string) => hidden(`${base}/${normalizeRef(ref)}/`);

/** Shown with a lock mark: protected and building the site members see. */
export const locked = (pathname: string) => variant === 'protected' && isProtectedPath(pathname);

export const loginHref = `${base}/_auth/login/`;
export const logoutHref = `${base}/_auth/logout/`;
export const meHref = `${base}/_auth/me/`;
