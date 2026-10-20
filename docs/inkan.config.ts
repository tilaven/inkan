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
    actions: [
      { text: 'Quick start', link: '/quick-start/', variant: 'primary' },
      { text: 'All features', link: '/decisions/', variant: 'secondary' },
      { text: 'Configuration', link: '/configuration/', variant: 'ghost' },
    ],
    sections: ['stats', 'content', 'projects', 'latest'],
  },
});
