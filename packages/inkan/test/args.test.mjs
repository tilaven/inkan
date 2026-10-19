import { describe, expect, it } from 'vitest';
import { parseArgs } from '../lib/args.mjs';

describe('parseArgs', () => {
  it('keeps positionals after boolean flags', () => {
    expect(parseArgs(['--dry-run', 'sre/adr/1', 'accepted'])).toEqual({ args: ['sre/adr/1', 'accepted'], flags: { 'dry-run': true } });
    expect(parseArgs(['a', '--dry-run', 'b', '--strict'])).toEqual({ args: ['a', 'b'], flags: { 'dry-run': true, strict: true } });
  });

  it('takes the next argument as the value of --date unless it is a flag', () => {
    expect(parseArgs(['a', '--date', 'b', '--strict'])).toEqual({ args: ['a'], flags: { date: 'b', strict: true } });
    expect(parseArgs(['a', '--date', '--strict'])).toEqual({ args: ['a'], flags: { date: true, strict: true } });
  });

  it('splits --key=value on the first = only', () => {
    expect(parseArgs(['--url=https://x/?a=b&c=d']).flags.url).toBe('https://x/?a=b&c=d');
  });

  it('still takes values for value flags and optional ones', () => {
    expect(parseArgs(['--port', '4000', '--host']).flags).toEqual({ port: '4000', host: true });
    expect(parseArgs(['--host', '0.0.0.0', '--root', 'x']).flags).toEqual({ host: '0.0.0.0', root: 'x' });
  });
});
