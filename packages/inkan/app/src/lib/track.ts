/** Event the analytics plugin forwards to every provider it loads. Without the plugin nothing listens. */
export const TRACK_EVENT = 'inkan:track';

export type TrackProps = Record<string, string | number | boolean>;

export function track(name: string, props: TrackProps = {}) {
  document.dispatchEvent(new CustomEvent(TRACK_EVENT, { detail: { name, props } }));
}
