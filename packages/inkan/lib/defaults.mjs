/** Defaults for every option in inkan.config.*. User values are merged on top. */
export const defaults = {
  title: 'Inkan',
  tagline: 'Architecture Decision Records and RFCs for every team, in one place.',
  description: 'Central, searchable record of architecture decisions (ADR) and proposals (RFC).',
  url: 'http://localhost:4321',
  base: '/',
  repo: { url: '', branch: 'main', provider: 'github' },
  contentDir: 'decisions',
  templatesDir: 'templates',
  pagesDir: 'pages',
  logo: null,
  favicon: null,
  customCss: [],
  theme: { default: 'system' },
  navigation: [],
  banner: null,
  footer: { copyright: '', links: [] },
  redirects: {},
  search: { enabled: true, type: 'pagefind', maxResults: 8 },
  head: [],
  components: {},
  mdxComponents: null,
  plugins: [],
  issueLinks: [],
  /** Records pulled from other repositories or folders into `<contentDir>/<project>` (see `inkan sync`). */
  sources: [],
  /** Fill missing `date` / `authors` from the first commit of each record. */
  git: { dates: true, authors: true, history: true },
  /** `@adr <id>` comments in code, listed on the record they mention. `false` turns the scan off. */
  codeRefs: { include: ['**/*'], exclude: ['**/*.{md,mdx}'], marker: '@adr' },
  /** Open Graph cards drawn from the covers (`/og/*.png`), so shared links unfurl with a picture. `false` turns them off. */
  og: { theme: 'light' },
  /** What `/export/` and `inkan export` include; statuses default to the "current" ones. */
  export: { title: '' },
  /** RFC review: approvals needed before a record counts as approved; `null` means every reviewer. */
  reviewers: { approvals: null },
  /** Periodic reviews of decided records: `every` schedules them from their date, `soon` is the warning window in days. */
  reviews: { every: null, soon: 30 },
  /** `inkan notify`: statuses worth a message, and the Slack, Teams or webhook channels that get it. */
  notify: { statuses: ['accepted'], channels: [] },
  /** Sign-in provider (`openid`, `auth0`, `entra`, `gitlab`, `github`); `null` keeps the site fully static and public. */
  authentication: null,
  /** Paths only signed-in users see, e.g. `['/handbook/*']`. Projects opt in with `protected: true` in `_project.yml`. */
  protectedRoutes: [],
  docTypes: {
    adr: { label: 'ADR', plural: 'Decisions', description: 'Architecture Decision Record' },
    rfc: { label: 'RFC', plural: 'Proposals', description: 'Request for Comments' },
  },
  statuses: {
    draft: { label: 'Draft', open: true },
    proposed: { label: 'Proposed', open: true },
    'in-review': { label: 'In review', open: true },
    accepted: { label: 'Accepted', current: true },
    implemented: { label: 'Implemented', current: true },
    rejected: { label: 'Rejected' },
    withdrawn: { label: 'Withdrawn' },
    deprecated: { label: 'Deprecated' },
    superseded: { label: 'Superseded' },
  },
  /** Custom front matter fields (risk, cost, …) shown on records and filterable on the index. `_project.yml` can add more. */
  fields: {},
  landing: {
    /** Defaults to `title` / `tagline`. */
    title: null,
    tagline: null,
    actions: [
      { text: 'Browse all records', link: '/decisions/', variant: 'primary' },
      { text: 'Timeline', link: '/timeline/', variant: 'ghost' },
      { text: 'Open decisions', link: '/backlog/', variant: 'ghost' },
    ],
    /** Order of the sections below the hero; remove one to hide it. "stats" adds the numbers to the hero, "content" renders `_landing.md`. */
    sections: ['stats', 'projects', 'latest', 'content', 'agents'],
  },
};
