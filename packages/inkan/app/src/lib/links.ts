import { url } from './decisions';

/** Site-relative paths get the base prefix; fragments, protocol-relative and absolute URLs pass through. */
export const resolveHref = (href: string) => (/^(#|\/\/|[a-z][a-z0-9+.-]*:)/i.test(href) ? href : url(href));

const PROVIDER_NAMES: Record<string, string> = { github: 'GitHub', gitlab: 'GitLab', bitbucket: 'Bitbucket' };

/** The display name of a repository host: `github` → `GitHub`. */
export const providerName = (id: string) => PROVIDER_NAMES[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);

const ICON_TYPES: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

export const iconType = (file: string) => ICON_TYPES[file.split('?')[0].split('.').pop()?.toLowerCase() ?? ''];
