import type { HalftoneOptions } from '@tilaven/inkan';
import { DEG, n } from '../../../lib/covers.mjs';

export { TAU, DEG, n, circle } from '../../../lib/covers.mjs';

export type Point = [number, number];

/** Closed polygon through the points. */
export const poly = (pts: readonly number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x!)} ${n(y!)}`).join('') + 'Z';

/** Point at distance `R` and angle `a` (radians) from the centre. */
export const polar = (cx: number, cy: number, R: number, a: number): Point => [cx + Math.cos(a) * R, cy + Math.sin(a) * R];

/** Rounded rectangle as a path, so it can also clip. */
export const rrect = (x: number, y: number, w: number, h: number, rad: number) => {
  const a = (dx: number, dy: number) => `a${n(rad)} ${n(rad)} 0 0 1 ${n(dx)} ${n(dy)}`;
  return `M${n(x + rad)} ${n(y)}h${n(w - 2 * rad)}${a(rad, rad)}v${n(h - 2 * rad)}${a(-rad, rad)}h${n(2 * rad - w)}${a(-rad, -rad)}v${n(2 * rad - h)}${a(rad, -rad)}Z`;
};

export const grey = (v: number) => {
  const c = Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${c}${c}${c}`;
};

/** Drawing surface handed to motifs: SVG defs and parts, plus halftone, clip and grain helpers. */
export class Canvas {
  readonly defs: string[] = [];
  readonly parts: string[] = [];
  private ids = 0;
  private threshold?: string;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly prefix: string,
  ) {}

  id() {
    return `${this.prefix}${(this.ids++).toString(36)}`;
  }
  add(markup: string) {
    this.parts.push(markup);
  }

  private stops(values: [number, string][]) {
    return values.map(([t, c]) => `<stop offset="${n(t)}" stop-color="${c}"/>`).join('');
  }

  /**
   * A real halftone: the field (grey ramps) is multiplied by a screen of
   * radial cones, one per cell, and thresholded. Where the field is strong
   * the cone stays above the threshold further from its centre: a bigger dot.
   */
  halftone({ spacing, angle, maxR, field, cls, clip }: HalftoneOptions) {
    const { w, h } = this;
    if (!this.threshold) {
      this.threshold = this.id();
      const fn = (c: string) => `<feFunc${c} type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1"/>`;
      this.defs.push(
        `<filter id="${this.threshold}" color-interpolation-filters="sRGB"><feComponentTransfer>${fn('R')}${fn('G')}${fn('B')}</feComponentTransfer></filter>`,
      );
    }
    // Dot radius grows with the square root of the field (`maxR * sqrt(f)`), so coverage is linear in the field.
    const r0 = maxR / (spacing / 2);
    const cone: [number, string][] = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((t) => [
      t,
      grey(t === 0 ? 1 : (0.1 * r0 * r0) / (t * t)),
    ]);
    const coneId = this.id();
    const patId = this.id();
    this.defs.push(
      `<radialGradient id="${coneId}">${this.stops(cone)}</radialGradient>`,
      `<pattern id="${patId}" width="${n(spacing)}" height="${n(spacing)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${n(angle * DEG)} ${n(w / 2)} ${n(h / 2)})"><rect width="${n(spacing)}" height="${n(spacing)}" fill="url(#${coneId})"/></pattern>`,
    );
    const layers: string[] = [];
    if (Array.isArray(field)) {
      for (const f of field) {
        const gid = this.id();
        const amp = f.amp ?? 1;
        const ramp: [number, string][] = [0, 0.25, 0.5, 0.75, 1].map((t) => [t, grey(amp * t * t * (3 - 2 * t))]);
        this.defs.push(
          `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n(f.x1)}" y1="${n(f.y1)}" x2="${n(f.x2)}" y2="${n(f.y2)}">${this.stops(ramp)}</linearGradient>`,
        );
        layers.push(gid);
      }
    } else {
      const gid = this.id();
      const ramp: [number, string][] = [];
      for (let t = 0; t <= 1.001; t += 0.125) ramp.push([t, grey(field.amp * Math.pow(1 - t, field.pow))]);
      this.defs.push(
        `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${n(field.cx)}" cy="${n(field.cy)}" r="${n(field.r)}">${this.stops(ramp)}</radialGradient>`,
      );
      layers.push(gid);
    }
    const maskId = this.id();
    const full = `width="${n(w)}" height="${n(h)}"`;
    const rects = [...layers, patId]
      .map((gid, i) => `<rect ${full} fill="url(#${gid})"${i ? ' class="mul"' : ''}/>`)
      .join('');
    this.defs.push(
      `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" ${full}><g filter="url(#${this.threshold})">${rects}</g></mask>`,
    );
    this.add(`<rect ${full} class="${cls} x" mask="url(#${maskId})"${clip ? ` clip-path="url(#${clip})"` : ''}/>`);
  }

  clip(d: string) {
    const id = this.id();
    this.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
    return id;
  }

  grain(seed: number, amount: number) {
    const id = this.id();
    this.defs.push(
      `<filter id="${id}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 ${n(amount)}"/></feComponentTransfer></filter>`,
    );
    this.add(`<rect width="${n(this.w)}" height="${n(this.h)}" filter="url(#${id})" class="gr"/>`);
  }
}
