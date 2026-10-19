import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run as supersede } from '../lib/commands/supersede.mjs';
import { parseFrontMatter } from '../lib/records.mjs';
import { tmpSite } from './helpers.mjs';

const record = (title, extra = '') => `---\ntitle: ${title}\nstatus: proposed\n${extra}---\n\nBody.\n`;
const noop = () => {};

describe('supersede', () => {
  it('is idempotent across spellings of the same record', async () => {
    const root = tmpSite({
      'decisions/sre/adr/0001-a.md': record('A'),
      'decisions/sre/adr/0002-b.md': record('B'),
    });
    for (const [o, n] of [['SRE-ADR-0001', 'SRE-ADR-0002'], ['sre/adr/1', 'sre/adr/2'], ['sre/adr/0001-a', 'sre/adr/0002-b']]) {
      await supersede({ args: [o, n], flags: {}, root, log: noop });
    }
    const read = (f) => parseFrontMatter(fs.readFileSync(path.join(root, 'decisions/sre/adr', f), 'utf8')).data;
    expect(read('0001-a.md').supersededBy).toEqual(['sre/adr/0002-b']);
    expect(read('0002-b.md').supersedes).toEqual(['sre/adr/0001-a']);
  });

  it('does not duplicate a link written as a ref', async () => {
    const root = tmpSite({
      'decisions/sre/adr/0001-a.md': record('A', 'supersededBy: [SRE-ADR-0002]\n'),
      'decisions/sre/adr/0002-b.md': record('B', 'supersedes: [sre/adr/1]\n'),
    });
    await supersede({ args: ['sre/adr/1', 'sre/adr/2'], flags: {}, root, log: noop });
    expect(fs.readFileSync(path.join(root, 'decisions/sre/adr/0001-a.md'), 'utf8')).toContain('supersededBy: [SRE-ADR-0002]');
    expect(fs.readFileSync(path.join(root, 'decisions/sre/adr/0002-b.md'), 'utf8')).toContain('supersedes: [sre/adr/1]');
  });
});
