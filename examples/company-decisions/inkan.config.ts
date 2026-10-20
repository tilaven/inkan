import { defineConfig } from '@tilaven/inkan';
import acmePlugin from './plugins/acme.ts';

export default defineConfig({
  title: 'Acme Decisions',
  tagline: 'Architecture decisions and RFCs from every Acme team, in one place.',
  url: 'https://decisions.acme.example',
  repo: { url: 'https://github.com/acme/decisions', branch: 'main', provider: 'github' },
  // Jira keys like PAY-123 become links.
  issueLinks: [{ pattern: '\\b((?:PAY|OPS)-\\d+)\\b', url: 'https://acme.atlassian.net/browse/$1' }],
  navigation: [{ label: 'Handbook', href: '/handbook/' }],
  // `@adr <record>` comments in code show up on the record. The whole repository is scanned by default;
  // this example sits in a monorepo, so only its own folder is.
  codeRefs: { include: ['examples/company-decisions/**'] },
  // Records kept in other repositories show up as projects. `dir` points at a folder checked in here (a stand-in for a
  // service repo); a real one uses `repo: 'git@github.com:acme/checkout.git'` and is fetched by `inkan sync`.
  sources: [{ project: 'checkout', dir: 'services/checkout' }],
  // Custom front matter fields: shown on each record and filterable on /decisions/. Payments adds its own in _project.yml.
  fields: {
    risk: { type: 'enum', values: ['low', 'medium', 'high'], column: true },
    cost: { type: 'number', unit: 'k€/year', description: 'Expected yearly run cost.' },
  },
  redirects: { '/adr': '/decisions/', '/sre/adr/0001': '/sre/adr/0001-define-slos-before-dashboards/' },
  components: { SidebarBottom: './components/SidebarBottom.astro' },
  mdxComponents: './components/mdx.ts',
  plugins: [acmePlugin],
});
