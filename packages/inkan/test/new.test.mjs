import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from '../lib/records.mjs';
import { tmpSite } from './helpers.mjs';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.mjs');
const runCli = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });

describe('inkan new', () => {
  it('writes titles starting with YAML indicators as valid front matter', () => {
    const root = tmpSite({ 'decisions/.keep': '' });
    expect(runCli(['new', 'adr', 'sre', '[RFC] Use queues', '--author', 'ann'], root).status).toBe(0);
    const [file] = fs.readdirSync(path.join(root, 'decisions/sre/adr'));
    expect(parseFrontMatter(fs.readFileSync(path.join(root, 'decisions/sre/adr', file), 'utf8')).data.title).toBe('[RFC] Use queues');
  });

  it('writes the defaults of the project\'s fields after the template keys', () => {
    const root = tmpSite({
      'inkan.config.mjs': 'export default { fields: { risk: { type: \'enum\', values: [\'low\', \'high\'], default: \'low\' }, owner: { type: \'text\', required: true }, areas: { type: \'list\', default: [\'infra\'] }, cost: { type: \'number\', default: 0 } } };\n',
      'decisions/sre/_project.yml': 'name: SRE\nfields:\n  cost: false\n  pci: { type: boolean, default: false }\n',
    });
    expect(runCli(['new', 'adr', 'sre', 'Use queues', '--author', 'ann'], root).status).toBe(0);
    const [file] = fs.readdirSync(path.join(root, 'decisions/sre/adr'));
    const text = fs.readFileSync(path.join(root, 'decisions/sre/adr', file), 'utf8');
    expect(text).toMatch(/^---\ntitle: Use queues\ndescription: .*\nstatus: proposed\ndate: [\d-]+\nauthors: \[ann\]\ndeciders: \[\]\ntags: \[\]\nrisk: low\nareas: \[infra\]\npci: false\n---\n/);
  });

  it('adds to an existing folder named by its slug', () => {
    const root = tmpSite({ 'decisions/Ops Plans/_project.yml': 'name: Ops Plans\n' });
    expect(runCli(['new', 'adr', 'ops-plans', 'Use queues', '--author', 'ann'], root).status).toBe(0);
    expect(fs.readdirSync(path.join(root, 'decisions'))).toEqual(['Ops Plans']);
    expect(fs.readdirSync(path.join(root, 'decisions/Ops Plans/adr'))).toEqual(['0001-use-queues.md']);
    expect(runCli(['new', 'adr', 'Ops Plans', 'Use topics', '--author', 'ann'], root).status).toBe(0);
    expect(runCli(['new', 'adr', 'New Team', 'Use topics', '--author', 'ann'], root).stderr).toContain('Invalid project name "New Team"');
  });

  it('quotes authors that would split inside the flow list', () => {
    const root = tmpSite({ 'decisions/.keep': '' });
    expect(runCli(['new', 'adr', 'sre', 'Use queues', '--author', 'Doe, John'], root).status).toBe(0);
    const [file] = fs.readdirSync(path.join(root, 'decisions/sre/adr'));
    const text = fs.readFileSync(path.join(root, 'decisions/sre/adr', file), 'utf8');
    expect(text).toContain('authors: ["Doe, John"]');
    expect(parseFrontMatter(text).data.authors).toEqual(['Doe, John']);
  });

  it('defaults the author to the _authors.yml handle of the git user, else the git name', () => {
    const root = tmpSite({ 'decisions/_authors.yml': '- id: jane\n  name: Jane Doe\n  email: jane@example.com\n' });
    for (const args of [['init', '-q'], ['config', 'user.name', 'Jane Doe'], ['config', 'user.email', 'jane@example.com']]) spawnSync('git', args, { cwd: root });
    const author = (title) => {
      expect(runCli(['new', 'adr', 'sre', title], root).status).toBe(0);
      const file = fs.readdirSync(path.join(root, 'decisions/sre/adr')).sort().at(-1);
      return parseFrontMatter(fs.readFileSync(path.join(root, 'decisions/sre/adr', file), 'utf8')).data.authors;
    };
    expect(author('By handle')).toEqual(['jane']);
    spawnSync('git', ['config', 'user.email', 'someone@example.com'], { cwd: root });
    expect(author('By name')).toEqual(['jane']);
    spawnSync('git', ['config', 'user.name', 'John Doe'], { cwd: root });
    expect(author('Unknown')).toEqual(['John Doe']);
    spawnSync('git', ['config', 'user.name', ''], { cwd: root });
    spawnSync('git', ['config', 'user.email', 'jane@example.com'], { cwd: root });
    expect(author('Only e-mail, matched')).toEqual(['jane']);
    spawnSync('git', ['config', 'user.email', 'someone@example.com'], { cwd: root });
    expect(author('Only e-mail, unmatched')).toEqual([]);
  });

  it('reports a broken config in one line', () => {
    const root = tmpSite({ 'inkan.config.mjs': "import { nope } from 'inkan-does-not-exist';\nexport default {};\n" });
    const r = runCli(['new', 'adr', 'sre', 'Title'], root);
    expect(r.status).toBe(1);
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(r.stderr).toContain('inkan-does-not-exist');
  });

  it('refuses project names that are not folder names', () => {
    const root = tmpSite({ 'decisions/.keep': '' });
    const r = runCli(['new', 'adr', '../../x', 'Title'], root);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Invalid project name');
    expect(fs.existsSync(path.join(root, '..', 'x'))).toBe(false);
  });

  it('reports a flag without its value instead of crashing', () => {
    const r = runCli(['check', '--root'], tmpSite({}));
    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toBe('--root needs a value');
  });
});
