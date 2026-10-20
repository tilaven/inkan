import { defineConfig } from 'vitest/config';

const exclude = ['**/node_modules/**', '**/dist/**'];

/** The app's plugin motifs come from Astro; unit tests see none unless they mock the module. */
const noPluginMotifs = {
  name: 'inkan-test-motifs',
  resolveId: (id: string) => (id === 'virtual:inkan/motifs' ? `\0${id}` : undefined),
  load: (id: string) => (id === '\0virtual:inkan/motifs' ? 'export default {};' : undefined),
};

export default defineConfig({
  plugins: [noPluginMotifs],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['packages/**/*.test.{ts,mjs}'], exclude: [...exclude, '**/*.build.test.*'] } },
      // Full site builds share the app's generated `.astro` folder, so they run one at a time.
      { extends: true, test: { name: 'build', include: ['packages/**/*.build.test.mjs'], exclude, fileParallelism: false } },
    ],
  },
});
