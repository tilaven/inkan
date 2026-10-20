import { definePlugin } from '@tilaven/inkan';

/** Tags every page with the owning team, links the on-call page from the header and adds a cover motif. */
export default definePlugin({
  name: 'acme',
  config: (config) => ({ ...config, description: `${config.description} Maintained by Platform Engineering.` }),
  head: [{ tag: 'meta', attrs: { name: 'acme:owner', content: 'platform-engineering' } }],
  navigation: [{ label: 'On-call', href: '/on-call/' }],
  motifs: { stamp: new URL('./stamp.ts', import.meta.url) },
});
