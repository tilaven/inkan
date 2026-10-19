import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchChromium } from '../lib/commands/export.mjs';

const notInstalled = () => {
  const e = new Error("Cannot find package 'playwright-core' imported from export.mjs");
  e.code = 'ERR_MODULE_NOT_FOUND';
  return Promise.reject(e);
};

describe('launchChromium without playwright-core', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fails the PDF export with an install hint', async () => {
    await expect(launchChromium({ required: true, load: notInstalled })).rejects.toThrow(/playwright-core is needed for the PDF export.*npm install playwright-core/);
  });

  it('warns and returns null when the browser is optional', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(launchChromium({ required: false, load: notInstalled })).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/playwright-core is not installed.*npm install playwright-core/));
  });

  it('does not blame playwright-core for another missing module', async () => {
    const e = new Error("Cannot find package 'chromium-bidi' imported from playwright-core/lib/server.js");
    e.code = 'ERR_MODULE_NOT_FOUND';
    await expect(launchChromium({ required: false, load: () => Promise.reject(e) })).rejects.toBe(e);
  });
});
