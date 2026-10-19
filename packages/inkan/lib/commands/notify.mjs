/**
 * inkan notify [--since <ref>] [--dry-run]
 * Posts to Slack, Teams or any webhook when records move into a notified status (default: accepted) between
 * `--since` and the working tree. In CI the range defaults to the pushed commits. Exit 1 when a delivery fails.
 */
import { closest, loadConfig } from '../config.mjs';
import { defaultSince, eventsFor, payloads, post, resolveChannels, siteUrl, statusChanges } from '../notify.mjs';
import { plural } from '../text.mjs';

export async function run({ flags, root, env = process.env, fetch = globalThis.fetch, log = console.log }) {
  const config = await loadConfig(root);
  const statuses = config.notify.statuses;
  const known = Object.keys(config.statuses);
  for (const status of [...statuses, ...config.notify.channels.flatMap((c) => c.statuses ?? [])]) {
    if (known.includes(status)) continue;
    const hint = closest(status, known);
    throw new Error(`notify: unknown status "${status}".${hint ? ` Did you mean "${hint}"?` : ''} Known: ${known.join(', ')}.`);
  }

  const since = flags.since === undefined ? defaultSince(env) : String(flags.since);
  if (!since) {
    log('No previous commit to compare with (first push of a branch); nothing to notify.');
    return 0;
  }
  const all = [...new Set([...statuses, ...config.notify.channels.flatMap((c) => c.statuses ?? [])])];
  const events = statusChanges(config, { since, statuses: all });
  const channels = resolveChannels(config, env);
  if (!events.length) {
    log(`No records moved into ${all.join(', ')} since ${since}.`);
    return 0;
  }
  log(events.map((e) => `${e.id}: ${e.previousStatus ?? '(new)'} -> ${e.status}`).join('\n'));
  if (!channels.length) {
    log('No notification channels: set notify.channels in the config or INKAN_SLACK_WEBHOOK / INKAN_TEAMS_WEBHOOK / INKAN_WEBHOOK.');
    return 0;
  }

  const site = { title: config.title, url: siteUrl(config) };
  let failed = 0;
  for (const channel of channels) {
    const own = eventsFor(channel, events, statuses);
    if (!own.length) continue;
    if (!channel.url) {
      log(`${channel.name}: skipped, no URL (is its secret set in this pipeline?)`);
      continue;
    }
    const bodies = payloads(channel, own, site);
    if (flags['dry-run']) {
      log(`${channel.name}: would send ${plural(bodies.length, 'message')} [dry run]\n${JSON.stringify(bodies, null, 2)}`);
      continue;
    }
    try {
      for (const body of bodies) await post(channel, body, { fetch });
      log(`${channel.name}: sent ${plural(bodies.length, 'message')} (${plural(own.length, 'record')})`);
    } catch (e) {
      failed++;
      log(`${channel.name}: failed, ${e instanceof Error ? e.message : e}`);
    }
  }
  return failed ? 1 : 0;
}
