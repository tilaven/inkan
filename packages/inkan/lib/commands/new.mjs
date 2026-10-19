import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.mjs';
import { projectFields } from '../fields.mjs';
import { matchAuthor } from '../git.mjs';
import { PROJECT_NAME, loadAuthors, loadProjects, parseFrontMatter, projectId, slugify, today, updateFrontMatter, yamlScalar } from '../records.mjs';

const USAGE = 'Usage: inkan new <type> <project> "<title>" [--author handle]';

const gitConfig = (key, cwd) => {
  try {
    return execSync(`git config ${key}`, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

/**
 * Author for a new record when `--author` is not given: the `_authors.yml` handle matching the git user
 * (by e-mail, then name), or the git user name when nobody matches; empty outside git. The e-mail is only
 * used for matching, never written.
 */
export function defaultAuthor(config, root) {
  const name = gitConfig('user.name', root);
  const email = gitConfig('user.email', root);
  if (!name && !email) return '';
  const handle = matchAuthor({ name, email }, loadAuthors(config.contentDir));
  return handle === email ? name : handle;
}

/** `inkan new <type> <project> "<title>"`: writes the next numbered record of that type from its template. */
export async function run({ args, flags, root, log = console.log }) {
  const config = await loadConfig(root);
  const [type, project, ...titleParts] = args;
  const title = titleParts.join(' ');
  if (!type || !project || !title) throw new Error(USAGE);
  if (!config.docTypes[type]) throw new Error(`Unknown type "${type}". Known: ${Object.keys(config.docTypes).join(', ')}.`);
  const id = projectId(project);
  if (config.sources.some((s) => s.project === id)) throw new Error(`"${project}" is fetched from a source; add records to its repository instead.`);
  // An existing folder is found by its name or its slug (`ops-plans` for `Ops Plans/`); a new one needs a plain name.
  const folder = loadProjects(config).get(id)?.folder;
  if (!folder && !PROJECT_NAME.test(project)) throw new Error(`Invalid project name "${project}": use letters, digits, - and _.`);
  const author = flags.author ?? defaultAuthor(config, root);

  const dir = path.join(config.contentDir, folder ?? project, type);
  fs.mkdirSync(dir, { recursive: true });
  const projectFile = path.join(config.contentDir, folder ?? project, '_project.yml');
  if (!fs.existsSync(projectFile)) {
    fs.writeFileSync(projectFile, `name: ${yamlScalar(project)}\ndescription:\nowners: []\n`);
    log(`Created ${path.relative(process.cwd(), projectFile)} – fill in the project details.`);
  }
  const next = Math.max(0, ...fs.readdirSync(dir).map((f) => Number(/^(\d+)/.exec(f)?.[1] ?? 0))) + 1;
  const file = path.join(dir, `${String(next).padStart(4, '0')}-${slugify(title)}.md`);
  const template = config.templates[type] ?? '---\ntitle: {{title}}\ndate: {{date}}\nauthors: [{{author}}]\n---\n';
  let text = template
    .replaceAll('{{title}}', yamlScalar(title))
    .replaceAll('{{date}}', today())
    .replaceAll('{{author}}', author ? yamlScalar(author, { inList: true }) : '');
  const have = parseFrontMatter(text).data;
  const defaults = Object.fromEntries(
    (projectFields(config).projects.get(id) ?? []).filter((f) => f.default !== undefined && !(f.name in have)).map((f) => [f.name, f.default]),
  );
  if (Object.keys(defaults).length) text = updateFrontMatter(text, defaults, file);
  fs.writeFileSync(file, text);
  log(`Created ${path.relative(process.cwd(), file)}`);
  return 0;
}
