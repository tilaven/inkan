import { expect, it, vi } from 'vitest';

vi.mock('virtual:inkan/motifs', () => ({ default: { broken: { draw: () => {} } } }));

it('rejects a plugin motif module whose default export is not a function', async () => {
  await expect(import('./motif-registry')).rejects.toThrow('inkan: plugin motif "broken" must default-export a function');
});
