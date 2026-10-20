import { defineConfig } from '@tilaven/inkan';

export default defineConfig({
  title: 'Inkan',
  tagline: 'Architecture decisions and RFCs for every team, in one place.',
  // Public URL of the site, used for llms.txt, RSS and the sitemap.
  url: 'https://decisions.example.com',
  // Enables "Edit this page" and "New ADR" buttons.
  repo: { url: 'https://github.com/your-org/decisions', branch: 'main', provider: 'github' },
  // Custom record metadata (types: text, number, boolean, date, enum, list, url); values are front matter keys.
  // fields: { risk: { type: 'enum', values: ['low', 'medium', 'high'] } },
});
