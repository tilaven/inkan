import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentNames, resolveComponent } from '../lib/components.mjs';
import { packageDir } from '../lib/config.mjs';

const appDir = path.join(packageDir, 'app');

describe('resolveComponent', () => {
  it('prefers the user override', () => {
    expect(resolveComponent('Sidebar', { Sidebar: '/site/Sidebar.astro' }, appDir)).toBe('/site/Sidebar.astro');
  });

  it('falls back to the built-in component', () => {
    expect(resolveComponent('Sidebar', {}, appDir)).toBe(path.join(appDir, 'src/components/Sidebar.astro'));
  });

  it('resolves unfilled slots to the empty component', () => {
    expect(resolveComponent('SidebarBottom', {}, appDir)).toBe(path.join(appDir, 'src/components/slots/Empty.astro'));
  });

  it('knows every overridable name', () => {
    expect(componentNames).toContain('Header');
    expect(componentNames).toContain('RecordBottom');
    expect(new Set(componentNames).size).toBe(componentNames.length);
  });
});
