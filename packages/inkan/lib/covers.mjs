/** Helpers for motif authors (`import { n, circle, TAU, DEG } from 'inkan/covers'`). */

export const TAU = Math.PI * 2;
export const DEG = 180 / Math.PI;

/**
 * A number as an SVG attribute value: one decimal, no `-0`.
 * @param {number} v
 */
export const n = (v) => {
  const s = (Math.round(v * 10) / 10).toString();
  return s === '-0' ? '0' : s;
};

/**
 * A `<circle>` element; `attrs` is raw attribute markup, e.g. ` class="k"`.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {string} [attrs]
 */
export const circle = (cx, cy, r, attrs = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${attrs}/>`;
