import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configModule, tmpSite } from './helpers.mjs';

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/cli.mjs');

const record = (meta, body = '## Context\nSome words.\n') => `---\n${meta.trimEnd()}\n---\n${body}`;
const files = {
  'inkan.config.mjs': configModule(`{ title: 'T', url: 'https://d.example', fields: { risk: { type: 'enum', values: ['low', 'high'], description: 'Blast radius' }, areas: { type: 'list' } }, statuses: { live: { label: 'Live', current: true }, old: { label: 'Old' }, draft: { label: 'Draft', open: true } } }`),
  'decisions/sre/_project.yml': 'name: SRE\ndescription: Reliability\nowners: [ania]\norder: 1\n',
  'decisions/sre/adr/0001-use-slos.md': record('title: Use SLOs\ndescription: Numbers first\nstatus: old\ndate: 2024-01-02\nauthors: [ania]\ntags: [slo]\nsupersededBy: [sre/adr/0002-use-slos-everywhere]'),
  'decisions/sre/adr/0002-use-slos-everywhere.md': record('title: Use SLOs everywhere\nstatus: live\ndate: 2025-03-04\nauthors: [ania, marek]\ntags: [slo, process]\nrisk: HIGH\nareas: [infra, ops]\nsupersedes: [sre/adr/0001-use-slos]', '## Decision\nEvery service has a **golden** SLO.\n'),
  'decisions/pay/_project.yml': 'name: Payments\norder: 2\nfields:\n  pci: { type: boolean, label: PCI scope }\n',
  'decisions/pay/rfc/0001-batches.md': record('title: Batches\nstatus: draft\ndate: 2026-01-01\nauthors: [jules]\ntags: [queue]\npci: true'),
  'decisions/pay/rfc/0002-hidden.md': record('title: Hidden\nstatus: draft\ndraft: true'),
};

/** Spawns `inkan mcp` and exchanges newline-delimited JSON-RPC with it. */
function client(cliArgs) {
  const child = spawn(process.execPath, [cli, 'mcp', ...cliArgs], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));
  const pending = new Map();
  const stray = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    const msg = JSON.parse(line);
    const list = Array.isArray(msg) ? msg : [msg];
    for (const m of list) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        p(Array.isArray(msg) ? msg : m);
      } else stray.push(m);
    }
  });
  let seq = 0;
  const send = (payload) => child.stdin.write(JSON.stringify(payload) + '\n');
  const request = (method, params) =>
    new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      send({ jsonrpc: '2.0', id, method, ...(params !== undefined && { params }) });
    });
  return {
    child,
    stray,
    stderr: () => stderr,
    request,
    notify: (method, params) => send({ jsonrpc: '2.0', method, ...(params !== undefined && { params }) }),
    raw: (line, ids) =>
      new Promise((resolve) => {
        for (const id of ids) pending.set(id, resolve);
        child.stdin.write(line + '\n');
      }),
    call: async (name, args) => (await request('tools/call', { name, arguments: args })).result,
    close: () => new Promise((resolve) => child.on('exit', resolve) && child.stdin.end()),
  };
}

const initialize = (c, protocolVersion = '2025-06-18') =>
  c.request('initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'vitest', version: '1' } });

describe('inkan mcp (local)', () => {
  let c;
  beforeAll(async () => {
    c = client(['--root', tmpSite(files)]);
  });
  afterAll(async () => {
    const code = await c.close();
    expect(code).toBe(0);
    expect(c.stray).toEqual([]);
  });

  it('initializes and echoes a supported protocol version', async () => {
    const res = await initialize(c);
    expect(res.result.protocolVersion).toBe('2025-06-18');
    expect(res.result.serverInfo.name).toBe('inkan');
    expect(res.result.capabilities).toEqual({ tools: {}, resources: {} });
    c.notify('notifications/initialized');
    expect((await c.request('ping')).result).toEqual({});
    expect(c.stderr()).toContain('client vitest connected');
  });

  it('lists the tools with JSON Schema inputs', async () => {
    const { result } = await c.request('tools/list');
    expect(result.tools.map((t) => t.name)).toEqual(['list_projects', 'search_records', 'get_record', 'due_reviews', 'rfc_reviews', 'list_fields', 'list_tags', 'list_authors']);
    const search = result.tools.find((t) => t.name === 'search_records');
    expect(Object.keys(search.inputSchema.properties)).toEqual(['project', 'type', 'status', 'tag', 'author', 'field', 'query', 'current_only', 'limit', 'offset']);
    expect(result.tools.find((t) => t.name === 'get_record').inputSchema.required).toEqual(['id']);
  });

  it('list_projects', async () => {
    const { content } = await c.call('list_projects', {});
    expect(JSON.parse(content[0].text).projects).toEqual([
      { id: 'sre', name: 'SRE', description: 'Reliability', owners: ['ania'], records: 2 },
      { id: 'pay', name: 'Payments', description: null, owners: [], records: 1 },
    ]);
  });

  it('search_records filters, searches bodies and pages', async () => {
    const ids = async (args) => JSON.parse((await c.call('search_records', args)).content[0].text).records.map((r) => r.id);
    expect(await ids({})).toEqual(['pay/rfc/0001-batches', 'sre/adr/0002-use-slos-everywhere', 'sre/adr/0001-use-slos']);
    expect(await ids({ project: 'SRE' })).toEqual(['sre/adr/0002-use-slos-everywhere', 'sre/adr/0001-use-slos']);
    expect(await ids({ type: 'rfc' })).toEqual(['pay/rfc/0001-batches']);
    expect(await ids({ status: 'old' })).toEqual(['sre/adr/0001-use-slos']);
    expect(await ids({ tag: 'process' })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    expect(await ids({ author: 'marek' })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    expect(await ids({ field: 'risk=high' })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    expect(await ids({ field: 'areas=OPS' })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    expect(await ids({ field: 'pci=true' })).toEqual(['pay/rfc/0001-batches']);
    expect(await ids({ field: 'risk=low' })).toEqual([]);
    expect(await ids({ query: 'GOLDEN' })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    expect(await ids({ query: 'numbers first' })).toEqual(['sre/adr/0001-use-slos']);
    expect(await ids({ current_only: true })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    expect(await ids({ limit: 1, offset: 1 })).toEqual(['sre/adr/0002-use-slos-everywhere']);
    const page = JSON.parse((await c.call('search_records', { limit: 1 })).content[0].text);
    expect(page).toMatchObject({ total: 3, offset: 0, limit: 1 });
    expect(page.records[0]).toEqual({
      id: 'pay/rfc/0001-batches',
      ref: 'PAY-RFC-0001',
      title: 'Batches',
      status: 'draft',
      date: '2026-01-01',
      project: 'pay',
      type: 'rfc',
      tags: ['queue'],
      fields: { pci: true },
      description: null,
    });
  });

  it('get_record resolves ids and the supersede chain', async () => {
    const res = await c.call('get_record', { id: 'SRE-ADR-0001' });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('```yaml\nid: sre/adr/0001-use-slos\n');
    expect(res.content[0].text).toContain('\n## Context\nSome words.');
    expect(res.content[0].text).not.toContain('file:');
    const r = res.structuredContent;
    expect(r).toMatchObject({
      id: 'sre/adr/0001-use-slos',
      ref: 'SRE-ADR-0001',
      status: 'old',
      current: false,
      url: 'https://d.example/sre/adr/0001-use-slos/',
      source: 'decisions/sre/adr/0001-use-slos.md',
      supersededBy: [{ id: 'sre/adr/0002-use-slos-everywhere', ref: 'SRE-ADR-0002', title: 'Use SLOs everywhere', status: 'live' }],
      currentRecord: { id: 'sre/adr/0002-use-slos-everywhere', ref: 'SRE-ADR-0002', title: 'Use SLOs everywhere', status: 'live' },
      fields: {},
      body: '## Context\nSome words.\n',
    });
    expect(r.file).toBeUndefined();
    const two = (await c.call('get_record', { id: 'sre/adr/2' })).structuredContent;
    expect(two.fields).toEqual({ risk: 'high', areas: ['infra', 'ops'] });
    expect((await c.call('get_record', { id: 'sre/adr/2' })).content[0].text).toContain('\nrisk: high\nareas: infra, ops\n');
    expect(two.current).toBe(true);
    expect(two.currentRecord).toBeNull();
    expect(two.supersedes[0].id).toBe('sre/adr/0001-use-slos');
  });

  it('reports bad input and unknown records as tool errors', async () => {
    expect(await c.call('get_record', { id: 'nope/adr/9' })).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining('No record matches "nope/adr/9"') }] });
    expect(await c.call('get_record', {})).toMatchObject({ isError: true, content: [{ text: 'id is required' }] });
    expect(await c.call('search_records', { field: 'risk' })).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('name=value') }] });
    expect(await c.call('search_records', { limit: 'ten' })).toMatchObject({ isError: true, content: [{ text: 'limit must be an integer' }] });
    const unknown = await c.request('tools/call', { name: 'drop_table', arguments: {} });
    expect(unknown.error.code).toBe(-32602);
  });

  it('list_fields returns the definitions and the projects with their own', async () => {
    const { fields, projects } = JSON.parse((await c.call('list_fields', {})).content[0].text);
    expect(fields).toEqual([
      { name: 'risk', label: 'Risk', type: 'enum', values: ['low', 'high'], unit: null, description: 'Blast radius' },
      { name: 'areas', label: 'Areas', type: 'list', values: null, unit: null, description: null },
    ]);
    expect(Object.keys(projects)).toEqual(['pay']);
    expect(projects.pay.map((f) => [f.name, f.label, f.type])).toEqual([['risk', 'Risk', 'enum'], ['areas', 'Areas', 'list'], ['pci', 'PCI scope', 'boolean']]);
  });

  it('list_tags and list_authors count records', async () => {
    expect(JSON.parse((await c.call('list_tags', {})).content[0].text)).toEqual({
      tags: [{ name: 'slo', count: 2 }, { name: 'process', count: 1 }, { name: 'queue', count: 1 }],
    });
    expect(JSON.parse((await c.call('list_authors', { project: 'sre' })).content[0].text)).toEqual({
      authors: [{ name: 'ania', count: 2 }, { name: 'marek', count: 1 }],
    });
  });

  it('serves records as decision:// resources', async () => {
    const { result: templates } = await c.request('resources/templates/list');
    expect(templates.resourceTemplates[0].uriTemplate).toBe('decision://{id}');
    const { result: list } = await c.request('resources/list');
    expect(list.resources.map((r) => r.uri)).toEqual(['decision://pay/rfc/0001-batches', 'decision://sre/adr/0002-use-slos-everywhere', 'decision://sre/adr/0001-use-slos']);
    expect(list.resources[2]).toMatchObject({ name: 'SRE-ADR-0001', title: 'Use SLOs', description: 'old: Numbers first', mimeType: 'text/markdown' });
    const { result } = await c.request('resources/read', { uri: 'decision://sre/adr/0001-use-slos' });
    expect(result.contents[0]).toMatchObject({ uri: 'decision://sre/adr/0001-use-slos', mimeType: 'text/markdown' });
    expect(result.contents[0].text).toContain('title: Use SLOs\n');
    expect(result.contents[0].text).toContain('## Context');
    const missing = await c.request('resources/read', { uri: 'decision://nothing' });
    expect(missing.error).toEqual({ code: -32002, message: 'Resource not found', data: { uri: 'decision://nothing' } });
  });

  it('answers unknown methods, bad JSON and batches per JSON-RPC', async () => {
    const res = await c.request('prompts/list');
    expect(res.error).toEqual({ code: -32601, message: 'Method not found: prompts/list' });
    const parse = await c.raw('{not json', [null]);
    expect(parse).toEqual({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    const batch = await c.raw('[{"jsonrpc":"2.0","id":901,"method":"ping"},{"jsonrpc":"2.0","method":"notifications/initialized"},{"jsonrpc":"2.0","id":902,"method":"ping"}]', [901, 902]);
    expect(batch).toEqual([{ jsonrpc: '2.0', id: 901, result: {} }, { jsonrpc: '2.0', id: 902, result: {} }]);
  });

  it('echoes an older supported version (without structuredContent) and falls back to the latest otherwise', async () => {
    const d = client(['--root', tmpSite(files)]);
    expect((await initialize(d, '2025-03-26')).result.protocolVersion).toBe('2025-03-26');
    const res = await d.call('list_tags', {});
    expect(JSON.parse(res.content[0].text).tags).toHaveLength(3);
    expect(res.structuredContent).toBeUndefined();
    expect(await d.close()).toBe(0);
    const e = client(['--root', tmpSite(files)]);
    expect((await initialize(e, '2024-11-05')).result.protocolVersion).toBe('2025-06-18');
    expect((await e.call('list_tags', {})).structuredContent).toEqual({ tags: expect.any(Array) });
    expect(await e.close()).toBe(0);
  });

  it('sees edits without a restart', async () => {
    const root = tmpSite(files);
    const d = client(['--root', root]);
    await initialize(d);
    expect(JSON.parse((await d.call('search_records', {})).content[0].text).total).toBe(3);
    const fs = await import('node:fs');
    fs.writeFileSync(path.join(root, 'decisions/sre/adr/0003-new.md'), record('title: New\nstatus: live\ndate: 2026-02-02'));
    expect(JSON.parse((await d.call('search_records', {})).content[0].text).total).toBe(4);
    expect(await d.close()).toBe(0);
  });
});

describe('inkan mcp (reviews)', () => {
  const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const reviewed = (offset) => `title: R${offset}\nstatus: live\ndate: 2020-01-01\nreviewBy: ${day(offset)}`;
  let c;
  beforeAll(async () => {
    c = client([
      '--root',
      tmpSite({
        'inkan.config.mjs': configModule(`{ statuses: { live: { label: 'Live', current: true }, old: { label: 'Old' } } }`),
        'decisions/sre/_project.yml': 'name: SRE\n',
        'decisions/sre/adr/0001-late.md': record(reviewed(-5)),
        'decisions/sre/adr/0002-soon.md': record(reviewed(10)),
        'decisions/sre/adr/0003-later.md': record(reviewed(90)),
        'decisions/sre/adr/0004-old.md': record('title: Old\nstatus: old\ndate: 2020-01-01\nreviewBy: 2021-01-01'),
        'decisions/sre/adr/0005-none.md': record('title: None\nstatus: live\ndate: 2020-01-01'),
        'decisions/pay/_project.yml': 'name: Pay\nreviewEvery: 1 year\n',
        'decisions/pay/adr/0001-yearly.md': record('title: Yearly\nstatus: live\ndate: 2020-01-01\nreviewed: 2025-10-01'),
      }),
    ]);
    await initialize(c);
  });
  afterAll(async () => {
    expect(await c.close()).toBe(0);
  });

  const due = async (args) => (await c.call('due_reviews', args)).structuredContent;

  it('lists overdue and soon-due records, most overdue first', async () => {
    const res = await due({});
    expect(res).toMatchObject({ within: 30, total: 3 });
    expect(res.records.map((r) => [r.id, r.days, r.urgency])).toEqual([
      ['pay/adr/0001-yearly', expect.any(Number), 'overdue'],
      ['sre/adr/0001-late', -5, 'overdue'],
      ['sre/adr/0002-soon', 10, 'soon'],
    ]);
    expect(res.records[1]).toMatchObject({ ref: 'SRE-ADR-0001', title: 'R-5', status: 'live', review: { due: day(-5), reviewed: null, every: null } });
    expect(res.records[0].review).toEqual({ due: '2026-10-01', reviewed: '2025-10-01', every: '1 year' });
  });

  it('filters by project and window', async () => {
    expect((await due({ project: 'SRE', within: 0 })).records.map((r) => r.id)).toEqual(['sre/adr/0001-late']);
    expect((await due({ all: true })).records.map((r) => r.id)).toEqual(['pay/adr/0001-yearly', 'sre/adr/0001-late', 'sre/adr/0002-soon', 'sre/adr/0003-later']);
    expect(await c.call('due_reviews', { within: -1 })).toMatchObject({ isError: true, content: [{ text: 'within must be at least 0' }] });
  });

  it('adds the review to get_record', async () => {
    const res = await c.call('get_record', { id: 'sre/adr/2' });
    expect(res.structuredContent.review).toEqual({ due: day(10), reviewed: null, every: null });
    expect(res.content[0].text).toContain(`review: due ${day(10)}\n`);
    expect((await c.call('get_record', { id: 'sre/adr/5' })).structuredContent.review).toBeNull();
  });
});

describe('inkan mcp (remote)', () => {
  const decisions = [
    {
      id: 'sre/adr/0002-use-slos-everywhere',
      ref: 'SRE-ADR-0002',
      title: 'Use SLOs everywhere',
      description: null,
      type: 'adr',
      project: 'sre',
      status: 'accepted',
      date: '2025-03-04',
      authors: ['ania', 'marek'],
      deciders: [],
      tags: ['slo', 'process'],
      fields: { risk: 'high' },
      supersedes: ['sre/adr/0001-use-slos'],
      supersededBy: [],
      related: [],
      url: 'https://d.example/sre/adr/0002-use-slos-everywhere/',
      markdown: 'https://d.example/sre/adr/0002-use-slos-everywhere.md',
      source: 'decisions/sre/adr/0002-use-slos-everywhere.md',
      review: { due: '2026-01-05', reviewed: null, every: '1 year' },
    },
    {
      id: 'sre/adr/0001-use-slos',
      ref: 'SRE-ADR-0001',
      title: 'Use SLOs',
      description: 'Numbers first',
      type: 'adr',
      project: 'sre',
      status: 'superseded',
      date: '2024-01-02',
      authors: ['ania'],
      deciders: [],
      tags: ['slo'],
      supersedes: [],
      supersededBy: ['sre/adr/0002-use-slos-everywhere'],
      related: [],
      url: 'https://d.example/sre/adr/0001-use-slos/',
      markdown: 'https://d.example/sre/adr/0001-use-slos.md',
      source: 'decisions/sre/adr/0001-use-slos.md',
    },
  ];
  const bodies = {
    '/sre/adr/0001-use-slos.md': files['decisions/sre/adr/0001-use-slos.md'],
    '/sre/adr/0002-use-slos-everywhere.md': files['decisions/sre/adr/0002-use-slos-everywhere.md'],
  };
  const requests = [];
  let server;
  let url;
  let c;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests.push(req.url);
      if (req.url === '/decisions.json') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(decisions));
      if (req.url === '/llms.txt') return res.writeHead(200).end('# T\n\n## SRE (sre)\n\nReliability\n\n- [x](y)\n');
      if (bodies[req.url]) return res.writeHead(200, { 'content-type': 'text/markdown' }).end(bodies[req.url]);
      res.writeHead(404).end('nope');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
    c = client(['--url', url]);
    await initialize(c);
  });
  afterAll(async () => {
    expect(await c.close()).toBe(0);
    server.close();
  });

  it('reads decisions.json and the raw Markdown of a record', async () => {
    expect(JSON.parse((await c.call('list_projects', {})).content[0].text)).toEqual({
      projects: [{ id: 'sre', name: 'SRE', description: 'Reliability', owners: [], records: 2 }],
    });
    const hits = JSON.parse((await c.call('search_records', { query: 'golden', current_only: true })).content[0].text);
    expect(hits.records.map((r) => r.id)).toEqual(['sre/adr/0002-use-slos-everywhere']);
    const risky = JSON.parse((await c.call('search_records', { field: 'risk=high' })).content[0].text);
    expect(risky.records.map((r) => [r.id, r.fields])).toEqual([['sre/adr/0002-use-slos-everywhere', { risk: 'high' }]]);
    expect(await c.call('list_fields', {})).toMatchObject({ isError: true });
    const r = (await c.call('get_record', { id: 'sre/adr/1' })).structuredContent;
    expect(r).toMatchObject({
      id: 'sre/adr/0001-use-slos',
      number: 1,
      current: false,
      url: 'https://d.example/sre/adr/0001-use-slos/',
      currentRecord: { id: 'sre/adr/0002-use-slos-everywhere', status: 'accepted' },
      body: '## Context\nSome words.\n',
    });
    const { result } = await c.request('resources/read', { uri: 'decision://SRE-ADR-0002' });
    expect(result.contents[0].text).toContain('**golden**');
    expect(requests.filter((u) => u === '/decisions.json')).toHaveLength(1);
    expect(requests.filter((u) => u === '/sre/adr/0001-use-slos.md')).toHaveLength(1);
  });

  it('reads the review schedule from decisions.json', async () => {
    const res = (await c.call('due_reviews', {})).structuredContent;
    expect(res.records).toMatchObject([{ id: 'sre/adr/0002-use-slos-everywhere', review: { due: '2026-01-05', reviewed: null, every: '1 year' }, urgency: 'overdue' }]);
    expect((await c.call('get_record', { id: 'sre/adr/2' })).structuredContent.review).toEqual({ due: '2026-01-05', reviewed: null, every: '1 year' });
    expect((await c.call('get_record', { id: 'sre/adr/1' })).structuredContent.review).toBeNull();
  });

  it('turns a failing fetch into a tool error', async () => {
    const d = client(['--url', `${url}/missing`]);
    await initialize(d);
    expect(await d.call('list_tags', {})).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('404') }] });
    expect(await d.close()).toBe(0);
  });

  it('rejects a bad --url', async () => {
    const d = client(['--url', 'ftp://x']);
    expect(await d.close()).toBe(1);
    expect(d.stderr()).toContain('--url must be');
  });
});

describe('inkan mcp (rfc reviews)', () => {
  const reviewFiles = {
    ...files,
    'decisions/pay/rfc/0003-queues.md': record('title: Queues\nstatus: draft\ndate: 2026-02-01\nauthors: [jules]\nreviewers:\n  ania: approved\n  marek: pending'),
    'decisions/pay/rfc/0004-limits.md': record('title: Limits\nstatus: draft\ndate: 2026-02-02\nauthors: [jules]\nreviewers:\n  marek: changes-requested'),
    'decisions/pay/rfc/0005-old.md': record('title: Old\nstatus: old\ndate: 2026-02-03\nreviewers: [marek]'),
  };
  const queues = {
    reviewers: [{ handle: 'ania', state: 'approved' }, { handle: 'marek', state: 'pending' }],
    rfcReview: { status: 'in-review', approved: 1, required: 2, waitingOn: ['marek'] },
  };

  it('lists open records with reviewers, optionally those waiting on one person', async () => {
    const c = client(['--root', tmpSite(reviewFiles)]);
    await initialize(c);
    const list = async (args) => (await c.call('rfc_reviews', args)).structuredContent.records.map((r) => r.id);
    expect(await list({})).toEqual(['pay/rfc/0004-limits', 'pay/rfc/0003-queues']);
    expect(await list({ reviewer: 'marek' })).toEqual(['pay/rfc/0003-queues']);
    expect(await list({ reviewer: 'jules' })).toEqual(['pay/rfc/0004-limits']);
    expect(await list({ reviewer: 'nobody' })).toEqual([]);
    const hit = (await c.call('rfc_reviews', { reviewer: 'marek' })).structuredContent.records[0];
    expect(hit).toMatchObject(queues);
    const search = (await c.call('search_records', { query: 'queues' })).structuredContent.records[0];
    expect(search).toMatchObject(queues);
    const text = (await c.call('get_record', { id: 'pay/rfc/3' })).content[0].text;
    expect(text).toContain('reviewers: ania (approved), marek (pending)\nrfcReview: in-review, waiting on marek\n');
    const plain = (await c.call('get_record', { id: 'sre/adr/1' })).structuredContent;
    expect(plain).not.toHaveProperty('reviewers');
    const { result } = await c.request('resources/read', { uri: 'decision://pay/rfc/0003-queues' });
    expect(result.contents[0].text).toContain('reviewers: ania (approved), marek (pending)');
    expect(await c.close()).toBe(0);
  });

  it('reads reviewers from a published decisions.json', async () => {
    const decisions = [
      { id: 'pay/rfc/0003-queues', title: 'Queues', status: 'draft', date: '2026-02-01', authors: [], tags: [], ...queues },
      { id: 'pay/rfc/0002-plain', title: 'Plain', status: 'draft', date: '2026-02-02', authors: [], tags: [], reviewers: [], rfcReview: { status: 'none', approved: 0, required: 0, waitingOn: [] } },
      { id: 'pay/rfc/0001-old', title: 'Old', status: 'old', date: '2026-02-03', authors: [], tags: [], reviewers: [{ handle: 'marek', state: 'pending' }], rfcReview: { status: 'closed', approved: 0, required: 1, waitingOn: [] } },
    ];
    const server = http.createServer((req, res) => (req.url === '/decisions.json' ? res.writeHead(200).end(JSON.stringify(decisions)) : res.writeHead(404).end()));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const c = client(['--url', `http://127.0.0.1:${server.address().port}`]);
    await initialize(c);
    const all = (await c.call('rfc_reviews', {})).structuredContent.records;
    expect(all).toMatchObject([{ id: 'pay/rfc/0003-queues', ...queues }]);
    expect((await c.call('rfc_reviews', { reviewer: 'ania' })).structuredContent.total).toBe(0);
    expect((await c.call('rfc_reviews', { reviewer: 'marek' })).structuredContent.total).toBe(1);
    expect(await c.close()).toBe(0);
    server.close();
  });
});
