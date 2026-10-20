import type { AstroIntegration } from 'astro';
import type { Plugin as VitePlugin } from 'vite';

/** Process inks used for projects: cyan, magenta, yellow, green, violet, orange. */
export type Ink = 'c' | 'm' | 'y' | 'g' | 'v' | 'o';

export interface StatusConfig {
  label: string;
  /** Still being decided: listed on the backlog, review deadlines are tracked. */
  open?: boolean;
  /** Describes how things are now. Only these records get foil. */
  current?: boolean;
  /** Built-in sticker to borrow for a custom status, e.g. 'accepted'. */
  sticker?: string;
  /** Sticker colour for custom statuses without a built-in sticker. */
  color?: string;
}

/** A custom front matter field (`fields` in the config or in `_project.yml`). */
export interface FieldConfig {
  /** Default: 'text'. `number` and `date` filter by range, `url` is not filtered. */
  type?: 'text' | 'number' | 'boolean' | 'date' | 'enum' | 'list' | 'url';
  /** Shown on the record and the filter. Default: the name in sentence case. */
  label?: string;
  description?: string;
  /** Allowed values: required for `enum`, optional for `list`. Also the order of the filter chips. */
  values?: string[];
  /** Records without the field fail the build and `inkan check`. */
  required?: boolean;
  /** Filter the records index by this field. Default: true. */
  filter?: boolean;
  /** Add a column to the index's table view. */
  column?: boolean;
  /** Printed after a `number`, e.g. 'k€/year'. */
  unit?: string;
  /** Written into new records by `inkan new`. */
  default?: string | number | boolean | string[];
}

export interface NavLink {
  label: string;
  href: string;
}

export interface HeadTag {
  tag: string;
  attrs?: Record<string, string | boolean>;
  content?: string;
}

/**
 * Components that can be replaced with your own `.astro` file.
 * Slots (`HeadEnd`, `HeaderEnd`, `SidebarTop`, …) render nothing by default.
 */
export type ComponentName =
  | 'Header'
  | 'Footer'
  | 'Banner'
  | 'Sidebar'
  | 'RecordHeader'
  | 'RecordFooter'
  | 'RecordHistory'
  | 'RecordCard'
  | 'PageActions'
  | 'LandingHero'
  | 'HeadEnd'
  | 'HeaderEnd'
  | 'SidebarTop'
  | 'SidebarBottom'
  | 'RecordTop'
  | 'RecordBottom';

interface SearchCommon {
  /** Default: true. */
  enabled?: boolean;
  /** Most results the palette shows. Default: 8. */
  maxResults?: number;
}

/**
 * Where the search palette gets its results. Every provider uses the same palette, button and ⌘K shortcut.
 * External providers index `search.json`, which `inkan build` writes for them.
 */
export type SearchConfig = SearchCommon &
  (
    | {
        type?: 'pagefind';
        ranking?: { termFrequency?: number; pageLength?: number; termSimilarity?: number; termSaturation?: number };
      }
    | { type: 'algolia'; appId: string; /** Search-only key. */ apiKey: string; indexName: string; params?: Record<string, unknown> }
    | { type: 'meilisearch'; host: string; /** Search-only key. */ apiKey?: string; indexUid: string; params?: Record<string, unknown> }
    | {
        type: 'typesense';
        host: string;
        /** Search-only key. */
        apiKey: string;
        collection: string;
        /** Default: 'title,description,content,tags'. */
        queryBy?: string;
        params?: Record<string, string | number | boolean>;
      }
    | {
        type: 'custom';
        /** Browser module whose default export is a `SearchProviderFactory`, relative to the config file. */
        module: string;
        options?: Record<string, unknown>;
      }
  );

export type { SearchContext, SearchHit, SearchProvider, SearchProviderFactory, SearchResults } from '../app/src/search/types';
export type { SearchRecord } from '../app/src/search/record';

interface CommentsCommon {
  /** Default: true. */
  enabled?: boolean;
  /** Record types that get comments. Default: ['rfc']. `comments: true` in front matter adds a single record. */
  types?: string[];
  /** Only records with one of these statuses. Default: every status. */
  statuses?: string[];
}

/** Discussion under records. Every provider renders below the record; `comments: false` in front matter hides it. */
export type CommentsConfig = CommentsCommon &
  (
    | {
        /** GitHub Discussions through https://giscus.app; the IDs come from its configuration page. */
        provider: 'giscus';
        /** `owner/name`. Default: taken from `repo.url` when it is on GitHub. */
        repo?: string;
        repoId: string;
        category: string;
        categoryId: string;
        /** Default: 'specific', one discussion per record id. */
        mapping?: 'specific' | 'pathname' | 'url' | 'title' | 'og:title';
        /** Default: true. */
        strict?: boolean;
        /** Default: true. */
        reactions?: boolean;
        /** Default: 'top'. */
        inputPosition?: 'top' | 'bottom';
        /** Default: 'en'. */
        lang?: string;
        /** giscus theme names or CSS URLs for Day and Stage. Default: 'light' / 'dark'. */
        theme?: { light?: string; dark?: string };
      }
    | {
        /** An issue per record on GitLab, read through the public API and linked for replies. */
        provider: 'gitlab';
        /** Project path, e.g. 'platform/decisions'. Default: taken from `repo.url` when it is on GitLab. */
        project?: string;
        /** Default: the origin of a GitLab `repo.url`, else 'https://gitlab.com'. */
        host?: string;
        /** Labels added to issues started from the site. */
        labels?: string[];
      }
    | {
        provider: 'custom';
        /** .astro component receiving `CommentsProps`, relative to the config file. */
        component: string;
        options?: Record<string, unknown>;
      }
  );

export type { CommentsProps } from '../app/src/comments/types';

export interface InkanPlugin {
  name: string;
  /**
   * Change the resolved config (absolute paths, defaults applied) before the site is built.
   * Runs on every load, including dev-server restarts, so it must be idempotent.
   */
  config?: (config: ResolvedConfig) => ResolvedConfig | void | Promise<ResolvedConfig | void>;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  vitePlugins?: VitePlugin[];
  integrations?: AstroIntegration[];
  /** Extra pages: `entrypoint` is an absolute path or file URL of an .astro page or endpoint. */
  pages?: { pattern: string; entrypoint: string | URL }[];
  /**
   * Cover motifs: name (`/^[a-z][a-z0-9-]*$/`) to a module (absolute path or file URL) whose default export is a
   * `MotifFn`. Projects pick a motif with `motif:` in `_project.yml`; a later plugin wins over a built-in of the same name.
   */
  motifs?: Record<string, string | URL>;
  head?: HeadTag[];
  /** Links appended to the top navigation. */
  navigation?: NavLink[];
}

/** A record that moved into a notified status, as `inkan notify` sends it. */
export interface NotifyEvent {
  id: string;
  ref: string | null;
  title: string;
  description: string | null;
  project: string;
  projectName: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  /** Null for a record added in the compared range. */
  previousStatus: string | null;
  previousStatusLabel: string | null;
  /** Names from `_authors.yml`, else the handles. */
  authors: string[];
  tags: string[];
  /** The record on the site when `url` is set, else the file in `repo`, else null. */
  url: string | null;
  /** Path relative to the repository root. */
  file: string;
}

export interface NotifyChannel {
  type: 'slack' | 'teams' | 'webhook';
  /** Incoming webhook URL. Read it from a CI secret (`process.env.…`); a channel without one is skipped. */
  url?: string;
  /** Shown in the command output instead of the URL. */
  name?: string;
  /** Only records of these projects. */
  projects?: string[];
  /** Only these record types. */
  types?: string[];
  /** Replaces `notify.statuses` for this channel. */
  statuses?: string[];
  /** `webhook` only: extra request headers. */
  headers?: Record<string, string>;
  /** `webhook` only: the JSON body to send instead of `{ site, events }`. */
  body?: (data: { site: { title: string; url: string | null }; events: NotifyEvent[] }) => unknown;
}
interface AuthenticationCommon {
  /** OAuth client id; the secret comes from the `INKAN_AUTH_CLIENT_SECRET` environment of `inkan serve`. */
  clientId: string;
  scopes?: string[];
  /** Who may sign in: any match lets the user in; no lists at all lets every signed-in user in. */
  allow?: { emails?: string[]; domains?: string[]; groups?: string[] };
  /**
   * Count `allow.emails` and `allow.domains` even when the provider does not say whether the address is verified.
   * Needed for providers that never send `email_verified`; an address flagged as unverified still never counts.
   */
  trustEmail?: boolean;
  /** Session length in seconds. Default: 8 hours. */
  maxAge?: number;
  redirectToAfterSignIn?: string;
  redirectToAfterSignOut?: string;
}

/** Sign-in provider for protected projects and routes; the site then needs `inkan serve` instead of static hosting. */
export type AuthenticationConfig = AuthenticationCommon &
  (
    | { type: 'openid'; issuer: string; groupsClaim?: string }
    | { type: 'auth0'; domain: string; groupsClaim?: string }
    | { type: 'entra'; tenantId: string }
    | { type: 'gitlab'; url?: string }
    | { type: 'github'; url?: string }
  );

export type ResolvedAuthentication = AuthenticationConfig & {
  scopes: string[];
  allow: { emails?: string[]; domains?: string[]; groups?: string[] };
  maxAge: number;
  /** OpenID issuer, derived for auth0, entra and gitlab. */
  issuer?: string;
  groupsClaim: string;
};

export interface InkanConfig {
  /** Site name shown in the header and on the landing page. */
  title?: string;
  tagline?: string;
  description?: string;
  /** Public URL of the deployed site (used for llms.txt, RSS and sitemap). */
  url?: string;
  /** Sub-path when not served from the domain root, e.g. '/decisions'. BASE_PATH env var overrides it. */
  base?: string;
  /** Repository holding the content. Enables "Edit page" and "New ADR" links. */
  repo?: { url: string; branch?: string; provider?: 'github' | 'gitlab' };
  /** Folder with the records, relative to the config file. Default: 'decisions'. */
  contentDir?: string;
  /** Folder with your own record templates (adr.md, rfc.md, …). Default: 'templates'. */
  templatesDir?: string;
  /** Folder with your own pages (.astro, .md, .mdx), served at their file path. Default: 'pages'. */
  pagesDir?: string;
  /** Logo and favicon (SVG/PNG), relative to the config file. */
  logo?: string;
  favicon?: string;
  /** Extra CSS files, relative to the config file. Override any `--inkan-*` token here. */
  customCss?: string[];
  theme?: {
    /** Initial theme before the reader picks one. Default: 'system'. */
    default?: 'system' | 'light' | 'dark';
  };
  /** Links in the header, after the built-in ones. */
  navigation?: NavLink[];
  /** A strip above the header. `message` may contain inline HTML. */
  banner?: { message: string; dismissible?: boolean } | null;
  footer?: {
    /** Inline HTML allowed. */
    copyright?: string;
    links?: NavLink[];
  };
  /** Old path → new path, e.g. moved records. */
  redirects?: Record<string, string>;
  /** Full-text search. `false` turns it off; the default is the Pagefind index built with the site. */
  search?: false | SearchConfig;
  /** Comments under records (RFCs by default). Off unless set. */
  comments?: false | CommentsConfig;
  /** Extra tags for every page's <head>. */
  head?: HeadTag[];
  /** Replace built-in components or fill slots. Paths are relative to the config file. */
  components?: Partial<Record<ComponentName, string>>;
  /** Module whose default export maps names to components available in every MDX file. */
  mdxComponents?: string;
  plugins?: InkanPlugin[];
  /** Turn issue keys into links. `$1` is replaced with the first capture group. */
  issueLinks?: { pattern: string; url: string }[];
  /**
   * Records kept in other repositories (or folders) and shown as a project here, exactly like a local
   * `<contentDir>/<project>`. One of `repo` (git URL, fetched by `inkan sync`) or `dir` (folder relative
   * to the config file); `path` is the records folder inside it (default `docs/decisions`), `branch` the git branch.
   */
  sources?: { project: string; repo?: string; provider?: 'github' | 'gitlab'; dir?: string; branch?: string; path?: string }[];
  /**
   * Fill missing `date` / `authors` from git history, and list who changed a record's status on its page (all default to true).
   */
  git?: { dates?: boolean; authors?: boolean; history?: boolean };
  /** Scan code for `@adr <record>` comments and list them on the record. `false` turns it off. */
  codeRefs?: false | { include?: string[]; exclude?: string[]; marker?: string };
  /** Open Graph cards (1200×630 PNG) drawn from the record covers, for link previews. `false` turns them off. */
  og?: false | { theme?: 'light' | 'dark' };
  /** Single-page export (`/export/`, `inkan export`). */
  export?: { statuses?: string[]; title?: string };
  /** RFC review (`reviewers` in front matter). `approvals`: how many are needed; unset means every reviewer. */
  reviewers?: { approvals?: number | null };
  /**
   * Periodic reviews of decided records, listed on `/reviews/` and reported by `inkan check`.
   * A record is due on its `reviewBy` date, or `every` after its last `reviewed` date (or its `date`).
   * Projects and records override `every` with `reviewEvery`.
   */
  reviews?: {
    /** Interval like `'1 year'`, `'6 months'`, `'90 days'`; `false` or null schedules only records with `reviewBy`. Default: null. */
    every?: string | false | null;
    /** Statuses that get reviews. Default: the `current` ones. */
    statuses?: string[];
    /** Days before the due date when a review counts as due soon. Default: 30. */
    soon?: number;
  };
  /** Messages from `inkan notify` when records move into one of `statuses` (default `['accepted']`). */
  notify?: { statuses?: string[]; channels?: NotifyChannel[] };
  /** Record types; the type is the folder name inside a project. Replaces the defaults (adr, rfc). */
  docTypes?: Record<string, { label: string; plural: string; description: string }>;
  /** Allowed statuses. Replaces the defaults. */
  statuses?: Record<string, StatusConfig>;
  /**
   * Custom front matter fields (risk, cost, data class, …) for every project's records: shown on the record,
   * filterable on the index and checked by the build. A `_project.yml` may add its own under `fields`,
   * redefine one, or turn one off with `false`.
   */
  fields?: Record<string, FieldConfig>;
  /**
   * Sign-in for the projects with `protected: true` in their `_project.yml` and the `protectedRoutes`.
   * `inkan build` then writes the public site to dist/ and the members' site to dist-protected/.
   */
  authentication?: AuthenticationConfig | null;
  /** Paths only signed-in users see, relative to `base`; `*` matches anything, e.g. `['/handbook/*']`. */
  protectedRoutes?: string[];
  /** Home page. Put extra Markdown in `<contentDir>/_landing.md` and list "content" in sections. */
  landing?: {
    title?: string;
    tagline?: string;
    actions?: { text: string; link: string; variant?: 'primary' | 'secondary' | 'ghost' }[];
    /** Any order of: 'stats', 'projects', 'latest', 'content', 'agents'. */
    sections?: string[];
  };
}

/** A `sources` entry after loadConfig: absolute folders, defaults applied and the layout found on disk. */
export interface ResolvedSource {
  project: string;
  repo: string | null;
  /** Absolute path of a `dir` source. */
  dir: string | null;
  branch: string | null;
  /** Records folder inside the source (default `docs/decisions`). */
  path: string;
  /** The clone (`node_modules/.inkan/sources/<project>`) or the local folder. */
  root: string;
  /** Absolute folder holding the `<type>/` subfolders. */
  contentDir: string;
  /** `contentDir` relative to `root`, e.g. `docs/decisions` or `docs/decisions/<project>`. */
  recordsPath: string;
  /** Web URL of `repo` (https form), when it can be derived. */
  web: string | null;
  /** Explicit `provider` of the source, else guessed from `repo`. */
  provider: 'github' | 'gitlab' | null;
  /** What git clones from: `repo` as given for remotes, a file:// URL for local paths. */
  remote: string | null;
  /** Branch the clone is on when `branch` is not set, once synced. */
  head: string | null;
}

export interface ResolvedConfig extends Required<Omit<InkanConfig, 'plugins' | 'banner' | 'sources' | 'authentication'>> {
  banner: { message: string; dismissible: boolean } | null;
  plugins: InkanPlugin[];
  sources: ResolvedSource[];
  authentication: ResolvedAuthentication | null;
  root: string;
  configFile: string | null;
  repoRoot: string;
  contentPath: string;
  templates: Record<string, string>;
}

export declare function defineConfig(config: InkanConfig): InkanConfig;
export declare function definePlugin(plugin: InkanPlugin): InkanPlugin;
export interface MotifOptions {
  /** Words in a project id or name (e.g. `security`, `frontend`) that make this motif the natural pick for that team. */
  keywords?: readonly string[];
}
export declare function defineMotif(fn: MotifFn, options?: MotifOptions): MotifFn & MotifOptions;

/** A greyscale ramp between two points: luminance = amp * smoothstep(a, b, t). */
export interface LinearField {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  amp?: number;
}
/** A radial fall-off from a centre: luminance = amp * (1 - t) ^ pow. */
export interface RadialField {
  cx: number;
  cy: number;
  r: number;
  pow: number;
  amp: number;
}
export interface HalftoneOptions {
  /** Distance between dots, in cover units (the default cover is 220 x 340). */
  spacing: number;
  /** Screen angle in radians. */
  angle: number;
  /** Radius of a dot where the field is 1. */
  maxR: number;
  /** Several linear fields multiply; the product is the dot size. */
  field: RadialField | LinearField[];
  /** Ink class of the dots: `a` main ink, `b` alt ink, `k` black, `p` paper. */
  cls: 'a' | 'b' | 'k' | 'p';
  /** Id returned by `clip()` to confine the raster to a shape. */
  clip?: string;
}

/**
 * The surface a motif draws on. Markup uses ink classes instead of colours, so one print works in Day and Stage:
 * `a` main ink, `b` alt ink, `k` black, `p` paper, `sa`/`sk` strokes, `n` no fill, `x` blend.
 */
export interface MotifCanvas {
  readonly w: number;
  readonly h: number;
  /** A fresh id for `<defs>` entries, unique across every cover on a page. */
  id(): string;
  /** Appends SVG markup to the print. */
  add(markup: string): void;
  /** A riso halftone raster: dots grow where the field is strong. */
  halftone(options: HalftoneOptions): void;
  /** Registers a clip path and returns its id. */
  clip(d: string): string;
}

/**
 * Draws one cover. `record` is a seeded generator per record, so every record differs;
 * `project` is seeded per project, for the choices all covers of one team share.
 */
export type MotifFn = (canvas: MotifCanvas, record: () => number, project: () => number) => void;
