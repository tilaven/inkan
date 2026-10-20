/// <reference path="../.astro/types.d.ts" />

declare module 'virtual:inkan/config' {
  const config: {
    title: string;
    tagline: string;
    description: string;
    url: string;
    base: string;
    /** Interface language, a canonical BCP 47 tag. */
    locale: string;
    root: string;
    appDir: string;
    repoRoot: string;
    /** Content folder relative to the repo root, e.g. `decisions`. */
    contentPath: string;
    repo: { url: string; branch: string; provider: 'github' | 'gitlab' };
    contentDir: string;
    pagesDir: string;
    templatesDir: string;
    logo: string | null;
    favicon: string | null;
    customCss: string[];
    theme: { default: 'system' | 'light' | 'dark' };
    /** Header links from the config plus those added by plugins. */
    navigation: { label: string; href: string }[];
    banner: { message: string; dismissible: boolean } | null;
    footer: { copyright: string; links: { label: string; href: string }[] };
    redirects: Record<string, string>;
    reviews: { every?: string | false | null; statuses?: string[]; soon?: number };
    search: { enabled: boolean; type: 'pagefind' | 'algolia' | 'meilisearch' | 'typesense' | 'custom'; maxResults: number };
    /** Resolved `comments` option; `provider` is null when comments are off. */
    comments: {
      enabled: boolean;
      provider: 'giscus' | 'gitlab' | 'custom' | null;
      types: string[];
      statuses: string[] | null;
    };
    /** Extra <head> tags from the config plus those added by plugins. */
    head: { tag: string; attrs?: Record<string, string | boolean>; content?: string }[];
    /** Absolute paths of the user's component overrides. */
    components: Partial<Record<string, string>>;
    mdxComponents: string | null;
    /** The user's pages from `pagesDir`: route without base and trailing slash, and how it is rendered. */
    pages: { route: string; kind: 'astro' | 'markdown' }[];
    issueLinks: { pattern: string; url: string }[];
    /** Fill missing `date` / `authors` from the first commit of each record. */
    git: { dates: boolean; authors: boolean; history: boolean };
    /** `@adr <record>` comments in code; `false` turns the scan off. */
    codeRefs: false | { include: string[]; exclude: string[]; marker: string };
    /** RFC review: approvals needed before a record counts as approved; null means every reviewer. */
    reviewers: { approvals: number | null };
    /** Open Graph cards; `false` turns them off. */
    og: false | { theme?: 'light' | 'dark' };
    /** Projects pulled from other repositories or folders, see ResolvedSource in lib/index.d.ts. */
    sources: {
      project: string;
      repo: string | null;
      dir: string | null;
      branch: string | null;
      path: string;
      root: string;
      contentDir: string;
      recordsPath: string;
      web: string | null;
      provider: 'github' | 'gitlab' | null;
      remote: string | null;
      head: string | null;
    }[];
    docTypes: Record<string, { label: string; plural: string; description: string }>;
    statuses: Record<string, { label: string; open?: boolean; current?: boolean; sticker?: string; color?: string }>;
    templates: Record<string, string>;
    /** Resolved sign-in provider, or null for a fully public site. */
    authentication: { type: 'openid' | 'auth0' | 'entra' | 'gitlab' | 'github'; clientId: string; [key: string]: unknown } | null;
    /** Paths (relative to `base`, `*` wildcards) only signed-in users see. */
    protectedRoutes: string[];
    /** Which site this build is, when `authentication` is set: what anonymous visitors get or what members get. */
    variant: 'public' | 'protected' | null;
    landing: {
      title: string | null;
      tagline: string | null;
      eyebrow: string | null;
      /** Absolute paths; the URLs come from `virtual:inkan/assets`. */
      image: { src: string; dark: string | null; alt: string } | null;
      command: string | null;
      features: { title: string; text: string; link?: string }[];
      actions: { text: string; link: string; variant?: 'primary' | 'secondary' | 'ghost' }[];
      sections: string[];
    };
  };
  export default config;
}

declare module 'virtual:inkan/i18n' {
  export const locale: string;
  /** Interface text for `locale`, with plugin and config `translations` applied. */
  export const messages: Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;
}

declare module 'virtual:inkan/assets' {
  /** URLs of the user's logo / favicon, or null to use the built-in ones. */
  export const logo: string | null;
  export const favicon: string | null;
  /** URLs of `landing.image` and its dark variant. */
  export const landingImage: string | null;
  export const landingImageDark: string | null;
}

declare module 'virtual:inkan/user-css' {}

declare module 'virtual:inkan/search' {
  /** Factory of the configured search provider and the options from `search` it is called with. */
  const create: import('./search/types').SearchProviderFactory;
  export const options: Record<string, unknown>;
  export default create;
}

declare module 'virtual:inkan/comments' {
  /** Component of the configured comments provider and its resolved options. */
  const Comments: ((props: import('./comments/types').CommentsProps) => unknown) | null;
  export const options: Record<string, unknown>;
  export default Comments;
}

declare module 'virtual:inkan/mdx-components' {
  /** The user's `mdxComponents` module: names available in every MDX file. */
  const components: Record<string, unknown>;
  export default components;
}

declare module 'virtual:inkan/motifs' {
  /** Cover motifs registered by plugins, by name. */
  const motifs: Record<string, import('@tilaven/inkan').MotifFn>;
  export default motifs;
}

declare module 'virtual:inkan/components/*' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
