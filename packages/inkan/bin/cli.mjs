#!/usr/bin/env node
/**
 * inkan CLI
 *   inkan init [dir]                     scaffold config, sample project and CI files
 *   inkan dev [--port 4321] [--host]      local server with hot reload (--public: what anonymous visitors see)
 *   inkan build [--offline]               static site in ./dist (sources are fetched first unless --offline);
 *                                                with `authentication` also the members' site in ./dist-protected
 *   inkan preview [--port 4321]           serve ./dist
 *   inkan serve [--port 8080] [--host]    production server for ./dist (sign-in when configured)
 * Every other command lives in lib/commands/<name>.mjs and exports `run({ args, flags, root })`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/args.mjs';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(pkgDir, 'app');
const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;

const [command, ...rest] = process.argv.slice(2);
const { args, flags } = parseArgs(rest);
for (const key of ['root', 'out', 'project', 'url', 'author', 'since', 'port', 'for', 'note']) {
  if (flags[key] === true) {
    console.error(`--${key} needs a value`);
    process.exit(1);
  }
}
const root = path.resolve(flags.root ?? process.cwd());

const help = `inkan ${version}

Usage:
  inkan init [dir]                       Create inkan.config.ts, a sample project and CI files
  inkan dev [--port 4321] [--host]       Start the dev server with hot reload (--public: hide protected records)
  inkan build [--offline]                Build the static site into ./dist (--offline: keep cached sources)
  inkan preview [--port 4321]            Serve the built site
  inkan serve [--port 8080] [--host]     Production server for ./dist (with sign-in when \`authentication\` is set)
  inkan new <type> <project> "<title>"   Create the next numbered record (type: adr, rfc, …)
  inkan status <record> <status>         Change a record's status (--date [YYYY-MM-DD]: also set the date)
  inkan rfc-review <record> <reviewer> <verdict>
                                         Record a review (approve, request-changes, reset; --note "…")
  inkan rfc-review --for <handle>        List the open records waiting on that reviewer
  inkan supersede <old> <new>            Mark <old> as superseded by <new> (updates both files)
  inkan reviewed <record> [--next <date>] [--every <interval>] [--date <date>]
                                                Mark a record reviewed and schedule its next review
  inkan reviews [--within <days>] [--all] [--json]
                                                List records that are due for review
  inkan import <dir> --project <name>    Convert log4brains, MADR or adr-tools records
  inkan check                            Validate references, numbering and project metadata
  inkan sync                             Fetch records from the repositories listed in \`sources\`
  inkan export [--pdf]                   Write every current decision to one HTML (or PDF) file
  inkan mcp [--url <site>]               MCP server (stdio) for AI agents to query records
  inkan notify [--since <ref>] [--dry-run] Tell Slack, Teams or a webhook about newly accepted records

Options:
  --root <dir>   Folder with inkan.config.* (default: current folder)
`;

/**
 * Records from `sources` repos must be in the cache before Astro reads the content:
 * `build` refreshes every clone (unless --offline), `dev` only fetches the ones that are missing.
 */
async function syncSourcesFor(cmd, config) {
  const { isMissing, syncSources } = await import('../lib/sources.mjs');
  if (!config.sources.some((s) => s.repo)) return;
  const missing = config.sources.filter(isMissing).map((s) => s.project);
  if (flags.offline) {
    if (missing.length) throw new Error(`--offline: no cached copy of source${missing.length === 1 ? '' : 's'} ${missing.join(', ')}; run \`inkan sync\` first`);
    return;
  }
  await syncSources(config, { missingOnly: cmd === 'dev' });
}

/**
 * With `authentication` the site is built twice: `public` (protected pages left out, safe to host anywhere) into dist/
 * and `protected` (everything, for signed-in users) into dist-protected/, where `_server.json` tells `inkan serve`
 * how to sign people in. The variant reaches astro.config.mjs through INKAN_VARIANT.
 */
async function buildSite(build, inline, config) {
  const protectedDir = path.join(root, 'dist-protected');
  if (!config.authentication) {
    delete process.env.INKAN_VARIANT;
    // Never leave an old members' site around for a server to pick up.
    fs.rmSync(protectedDir, { recursive: true, force: true });
    await build(inline);
    return;
  }
  for (const variant of ['public', 'protected']) {
    console.log(`inkan: building the ${variant} site into ${variant === 'public' ? 'dist' : 'dist-protected'}/`);
    process.env.INKAN_VARIANT = variant;
    await build(inline);
  }
  const { base, url, authentication, protectedRoutes } = config;
  fs.writeFileSync(path.join(protectedDir, '_server.json'), JSON.stringify({ base, url, authentication, protectedRoutes }, null, 2) + '\n');
}

async function runCommand(name, flags) {
  const { run } = await import(`../lib/commands/${name}.mjs`);
  try {
    process.exitCode = (await run({ args, flags, root })) ?? 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

async function astro(cmd) {
  process.env.INKAN_ROOT = root;
  if (cmd === 'preview' && fs.existsSync(path.join(root, 'dist-protected', '_server.json'))) {
    // A site built with `authentication` needs the sign-in server, not Astro's static preview.
    return runCommand('serve', { port: 4321, host: 'localhost', ...flags });
  }
  let config;
  if (cmd !== 'preview') {
    try {
      const { loadConfig } = await import('../lib/config.mjs');
      config = await loadConfig(root);
      await syncSourcesFor(cmd, config);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }
  const { dev, build, preview } = await import('astro');
  const inline = { root: appDir, server: {} };
  if (flags.port) inline.server.port = Number(flags.port);
  if (flags.host) inline.server.host = flags.host === true ? true : flags.host;
  if (cmd === 'dev') {
    // Authors see everything, lock marks included; --public shows the site as anonymous visitors get it.
    if (config.authentication) process.env.INKAN_VARIANT = flags.public ? 'public' : 'protected';
    await dev(inline);
  } else if (cmd === 'build') await buildSite(build, inline, config);
  else await preview(inline);
}

function init() {
  const target = path.resolve(args[0] ?? root);
  const starter = path.join(pkgDir, 'starter');
  fs.mkdirSync(target, { recursive: true });
  const copied = [];
  const renamed = { _gitignore: '.gitignore', _dockerignore: '.dockerignore' };
  const copy = (from, to) => {
    for (const name of fs.readdirSync(from)) {
      const src = path.join(from, name);
      const dest = path.join(to, renamed[name] ?? name);
      if (fs.statSync(src).isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        copy(src, dest);
      } else if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        copied.push(path.relative(target, dest));
      }
    }
  };
  copy(starter, target);
  // package.json: create, or add scripts to an existing one.
  const pkgFile = path.join(target, 'package.json');
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : { name: path.basename(target), private: true, type: 'module' };
  pkg.scripts = {
    dev: 'inkan dev',
    build: 'inkan build',
    preview: 'inkan preview',
    new: 'inkan new',
    status: 'inkan status',
    supersede: 'inkan supersede',
    check: 'inkan check',
    ...pkg.scripts,
  };
  pkg.type ??= 'module';
  if (!pkg.dependencies?.['inkan']) pkg.devDependencies = { 'inkan': `^${version}`, ...pkg.devDependencies };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`inkan initialised in ${target}\n${copied.map((f) => `  + ${f}`).join('\n')}\n  ~ package.json\n\nNext:\n  ${target === process.cwd() ? '' : `cd ${path.relative(process.cwd(), target)} && `}npm install && npm run dev\n`);
}

switch (command) {
  case 'dev':
  case 'build':
  case 'preview':
    await astro(command);
    break;
  case 'init':
    init();
    break;
  case 'new':
  case 'status':
  case 'rfc-review':
  case 'supersede':
  case 'reviewed':
  case 'reviews':
  case 'import':
  case 'check':
  case 'sync':
  case 'export':
  case 'mcp':
  case 'notify':
  case 'serve':
    await runCommand(command, flags);
    break;
  case '--version':
  case '-v':
    console.log(version);
    break;
  default:
    console.log(help);
    process.exit(command && command !== 'help' && command !== '--help' ? 1 : 0);
}
