import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  title: 'Inkan',
  tagline: 'Docs for Inkan, written as the decisions behind each feature.',
  url: 'https://useinkan.dev',
  description: 'How to install, configure, extend and deploy inkan. Every feature is documented as an ADR, so this site is also a live example.',
  repo: { url: 'https://github.com/tilaven/inkan', branch: 'main', provider: 'github' },
  // The repository's code carries @adr markers for the example site, not for these docs.
  codeRefs: false,
  // A custom field: the config options or front matter keys that a feature ADR documents. Shown on the record,
  // filterable on /decisions/ and listed as a column in the table view.
  fields: {
    options: {
      type: 'list',
      label: 'Config options',
      description: 'The inkan.config options and front matter keys this ADR documents.',
      column: true,
    },
  },
  footer: { links: [{ label: 'GitHub', href: 'https://github.com/tilaven/inkan' }] },
  landing: {
    eyebrow: '印鑑 · ADR & RFC sites',
    tagline:
      'Decisions deserve a home as good as your API docs. Inkan turns a folder of Markdown architecture decision records and RFCs into a fast, searchable site: a folder per team, a printed cover per record, one place to find out why things are the way they are.',
    image: {
      src: './assets/hero-light.webp',
      dark: './assets/hero-dark.webp',
      alt: 'A fan of five record cards with risograph-style covers for the SRE, Payments, Platform, DBRE and Checkout teams.',
    },
    actions: [
      { text: 'Quick start', link: '/quick-start/', variant: 'primary' },
      { text: 'What is Inkan', link: '/introduction/', variant: 'secondary' },
      { text: 'GitHub', link: 'https://github.com/tilaven/inkan', variant: 'ghost' },
    ],
    command: 'npm create @tilaven/inkan@latest my-decisions',
    features: [
      {
        title: 'Plain Markdown',
        text: 'Records live in your repo, reviewed in pull requests like code. No database, no CMS. GitHub and GitLab Markdown, Mermaid, math and callouts.',
        link: '/authoring/',
      },
      {
        title: 'One site, every team',
        text: 'SRE, Payments, Infra, DBRE: a folder each, with its own cover art, owners and record numbers, all in one search.',
        link: '/site/',
      },
      {
        title: 'Find anything',
        text: 'Full-text search, filters by team, status, author, tag and your own fields, a timeline, a decision graph and print export.',
        link: '/site/',
      },
      {
        title: 'Run the process',
        text: 'Open decisions with deadlines, periodic reviews, RFC reviews, comments, notifications and inkan check in CI.',
        link: '/cli/',
      },
      {
        title: 'Built for agents',
        text: 'llms.txt, decisions.json, a Markdown copy of every page and an MCP server, so coding agents know why the code looks the way it does.',
        link: '/ai/',
      },
      {
        title: 'Yours to shape',
        text: 'Plugins, component overrides, custom pages and CSS tokens. Static output that deploys to any host, with sign-in for internal projects.',
        link: '/extending/',
      },
    ],
    sections: ['features', 'content', 'projects', 'latest'],
  },
});
