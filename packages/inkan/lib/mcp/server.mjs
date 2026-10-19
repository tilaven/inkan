import { createInterface } from 'node:readline';
import { listResources, readResource, resourceTemplates, ToolError, tools, validateArgs } from './tools.mjs';

/** @typedef {import('./source.mjs').Source} Source */

/** Newest first; the client's version is echoed when it is one of these, otherwise the newest is offered. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26'];

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const RESOURCE_NOT_FOUND = -32002;

export class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

const negotiate = (requested) => (PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]);

/**
 * The MCP server itself, independent of the transport: `handle(message)` takes one parsed JSON-RPC message
 * and resolves to the response to send, or undefined for notifications.
 * @param {{ source: Source, name?: string, version?: string, log?: (line: string) => void }} opts
 */
export function createServer({ source, name = 'inkan', version = '0.0.0', log = () => {} }) {
  let protocolVersion = PROTOCOL_VERSIONS[0];

  const methods = {
    async initialize(params) {
      protocolVersion = negotiate(params?.protocolVersion);
      log(`client ${params?.clientInfo?.name ?? 'unknown'} connected (protocol ${protocolVersion}, ${source.mode}: ${source.label})`);
      return {
        protocolVersion,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name, version },
        instructions:
          'Architecture decision records (ADRs) and RFCs. Start with list_projects or search_records; ' +
          'only records whose status is current (search_records with current_only) describe how things are done today. ' +
          'get_record returns the full Markdown and tells you whether a record was superseded and by what.',
      };
    },
    async ping() {
      return {};
    },
    async 'tools/list'() {
      return { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
    },
    async 'tools/call'(params) {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) throw new RpcError(INVALID_PARAMS, `Unknown tool: ${params?.name}`);
      try {
        const args = validateArgs(tool.inputSchema, params.arguments ?? {});
        const result = await tool.run(args, source);
        const text = tool.text ? tool.text(result) : JSON.stringify(result);
        const response = { content: [{ type: 'text', text }] };
        if (protocolVersion >= '2025-06-18') response.structuredContent = result;
        return response;
      } catch (e) {
        if (!(e instanceof ToolError)) log(`${tool.name} failed: ${e instanceof Error ? e.stack ?? e.message : e}`);
        return { content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true };
      }
    },
    async 'resources/list'() {
      return { resources: await listResources(source) };
    },
    async 'resources/templates/list'() {
      return { resourceTemplates };
    },
    async 'resources/read'(params) {
      if (typeof params?.uri !== 'string') throw new RpcError(INVALID_PARAMS, 'uri is required');
      const contents = await readResource(source, params.uri);
      if (!contents) throw new RpcError(RESOURCE_NOT_FOUND, 'Resource not found', { uri: params.uri });
      return { contents: [contents] };
    },
  };

  async function handle(message) {
    const isRequest = message && typeof message === 'object' && !Array.isArray(message) && message.jsonrpc === '2.0' && typeof message.method === 'string';
    const id = message?.id;
    const hasId = id !== undefined && id !== null;
    if (!isRequest) return hasId || message?.jsonrpc !== '2.0' ? reply(hasId ? id : null, { error: { code: INVALID_REQUEST, message: 'Invalid Request' } }) : undefined;
    if (!hasId) return undefined; // notification: nothing to answer (notifications/initialized, notifications/cancelled, …)
    const method = methods[message.method];
    if (!method) return reply(id, { error: { code: METHOD_NOT_FOUND, message: `Method not found: ${message.method}` } });
    try {
      return reply(id, { result: await method(message.params) });
    } catch (e) {
      if (e instanceof RpcError) return reply(id, { error: { code: e.code, message: e.message, ...(e.data !== undefined && { data: e.data }) } });
      log(`${message.method} failed: ${e instanceof Error ? e.stack ?? e.message : e}`);
      return reply(id, { error: { code: INTERNAL_ERROR, message: e instanceof Error ? e.message : String(e) } });
    }
  }

  return { handle, get protocolVersion() { return protocolVersion; } };
}

const reply = (id, rest) => ({ jsonrpc: '2.0', id, ...rest });

/**
 * Serves the MCP server over stdio: one JSON-RPC message (or, for older clients, a batch) per line on stdin,
 * one response per line on stdout. Resolves when stdin closes.
 * @param {ReturnType<typeof createServer>} server
 */
export function serveStdio(server, { input = process.stdin, output = process.stdout } = {}) {
  const send = (msg) => output.write(JSON.stringify(msg) + '\n');
  let chain = Promise.resolve();
  return new Promise((resolve) => {
    const rl = createInterface({ input, crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        send(reply(null, { error: { code: PARSE_ERROR, message: 'Parse error' } }));
        return;
      }
      // Messages are answered in order; a batch gets one array back, per JSON-RPC 2.0.
      chain = chain.then(async () => {
        if (Array.isArray(parsed)) {
          if (!parsed.length) send(reply(null, { error: { code: INVALID_REQUEST, message: 'Invalid Request' } }));
          const out = (await Promise.all(parsed.map((m) => server.handle(m)))).filter(Boolean);
          if (out.length) send(out);
        } else {
          const res = await server.handle(parsed);
          if (res) send(res);
        }
      });
    });
    rl.on('close', () => chain.then(resolve));
  });
}
