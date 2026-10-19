import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Temporary site folder with the given files (`{ 'inkan.config.mjs': '...' }`). */
export function tmpSite(files = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-test-')));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

export const configModule = (body) => `export default ${body};\n`;

export const git = (args, cwd) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A bare "service repo" with records under `docs/decisions`; returns helpers to add commits to it. */
export function bareRepo(files, { branch = 'main' } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-src-')));
  const work = path.join(dir, 'work');
  const remote = path.join(dir, 'remote.git');
  fs.mkdirSync(work);
  git(['init', '-q', '-b', branch], work);
  git(['config', 'user.email', 'test@example.com'], work);
  git(['config', 'user.name', 'Test'], work);
  const commit = (files, message = 'update') => {
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
      fs.writeFileSync(path.join(work, file), content);
    }
    git(['add', '-A'], work);
    git(['commit', '-q', '-m', message], work);
    git(['push', '-q', remote, branch], work);
    return git(['rev-parse', '--short', 'HEAD'], work);
  };
  git(['init', '-q', '--bare', '-b', branch, remote], dir);
  commit({ 'src/app.js': 'console.log(1);\n', ...files }, 'init');
  return { remote, commit };
}
