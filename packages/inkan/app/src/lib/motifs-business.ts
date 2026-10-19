import { TAU, DEG, n, circle, poly, polar, rrect, type Point } from './canvas';
import { type MotifFn, pick, rect, circlePath } from './motifs';

type Frame = (x: number, y: number) => Point;

const pt = ([x, y]: Point) => `${n(x)} ${n(y)}`;

/** Maps local coordinates to the card: rotate by `deg`, move to (ox, oy), optionally mirror across the card. */
const frame = (ox: number, oy: number, deg: number, mirrorW = 0): Frame => {
  const cos = Math.cos(deg / DEG);
  const sin = Math.sin(deg / DEG);
  return (x, y) => {
    const gx = ox + x * cos - y * sin;
    return [mirrorW ? mirrorW - gx : gx, oy + x * sin + y * cos];
  };
};

/** A thick line with round caps, as a filled path. */
const bar = (x1: number, y1: number, x2: number, y2: number, t: number) => {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = ((y1 - y2) / len) * t * 0.5;
  const ny = ((x2 - x1) / len) * t * 0.5;
  return (
    poly([
      [x1 + nx, y1 + ny],
      [x2 + nx, y2 + ny],
      [x2 - nx, y2 - ny],
      [x1 - nx, y1 - ny],
    ]) +
    circlePath(x1, y1, t / 2) +
    circlePath(x2, y2, t / 2)
  );
};

const star = (cx: number, cy: number, Ro: number, Ri: number, points: number, phase: number) => {
  const pts: Point[] = [];
  for (let i = 0; i < points * 2; i++) pts.push(polar(cx, cy, i % 2 ? Ri : Ro, phase + (i * TAU) / (points * 2)));
  return poly(pts);
};

/** Four-point sparkle: tips joined by curves that bow in towards the centre. */
const spark = (cx: number, cy: number, R: number, phase: number) => {
  const tip = (i: number) => polar(cx, cy, R, phase + (i * TAU) / 4);
  const ctl = (i: number) => polar(cx, cy, R * 0.32, phase + ((i + 0.5) * TAU) / 4);
  let d = `M${pt(tip(0))}`;
  for (let i = 0; i < 4; i++) d += `Q${pt(ctl(i))} ${pt(tip(i + 1))}`;
  return d + 'Z';
};

/** Leaf between `a` and `b`, bulging `bulge` to each side; `skew` shifts the belly along the axis. */
const leaf = (a: Point, b: Point, bulge: number, skew: number) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const mx = a[0] + ux * len * (0.5 + skew);
  const my = a[1] + uy * len * (0.5 + skew);
  const c1: Point = [mx - uy * bulge, my + ux * bulge];
  const c2: Point = [mx + uy * bulge, my - ux * bulge];
  return `M${pt(a)}Q${pt(c1)} ${pt(b)}Q${pt(c2)} ${pt(a)}Z`;
};

const baseline = (w: number, y: number) =>
  `<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(y)}H${n(w)}"/>`;

/** Cover motifs for the business side of the company: people, legal, sales, marketing and the like. */
export const BUSINESS_MOTIFS: Record<string, MotifFn> = {
  book(c, r, p) {
    const { w, h } = c;
    const ribbon = pick(p, [-1, 1]);
    const figure = p() < 0.5;
    const cx = w * (0.47 + r() * 0.06);
    const top = h * (0.2 + r() * 0.05);
    const H = h * 0.5;
    const half = w * 0.54;
    const dip = h * 0.055;
    const bot = top + H;
    const mid = top + H / 2;
    const page = (s: number) =>
      `M${n(cx)} ${n(top + dip)}Q${n(cx + s * half * 0.5)} ${n(top - dip * 0.2)} ${n(cx + s * half)} ${n(top)}V${n(bot)}Q${n(cx + s * half * 0.5)} ${n(bot - dip * 0.2)} ${n(cx)} ${n(bot + dip)}Z`;
    const pages = page(-1) + page(1);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy: mid, r: w * 1.05, pow: 1.5, amp: 1.1 },
    });
    const cover = `translate(${n(cx)} ${n(mid + h * 0.055)}) scale(1.09) translate(${n(-cx)} ${n(-mid)})`;
    c.add(`<g transform="${cover}"><path class="b x sk" stroke-width="2.6" d="${pages}"/></g>`);
    c.add(`<path class="p" d="${pages}"/>`);
    const skew = Math.atan(dip / half) * DEG;
    const margin = w * 0.07;
    for (const s of [-1, 1]) {
      let lines = '';
      const x = s < 0 ? -half + margin : margin;
      const start = figure && s > 0 ? 3 : 0;
      if (start)
        lines += rect(x, top + dip + margin, half - 2 * margin, h * 0.12, ' class="b x sk" stroke-width="1.4"');
      for (let i = start; i < 6; i++) {
        const ly = top + dip + margin + i * h * 0.058;
        if (ly > bot - margin) break;
        lines += rect(x, ly, (half - 2 * margin) * (0.55 + r() * 0.45), h * 0.013, ' class="k"');
      }
      c.add(`<g transform="translate(${n(cx)} 0) skewY(${n(-s * skew)})">${lines}</g>`);
    }
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(pages),
      field: { cx, cy: bot + dip, r: half * 0.9, pow: 2, amp: 0.6 },
    });
    c.add(`<path class="sk n" stroke-width="2.8" d="${pages}"/>`);
    const rw = w * 0.1;
    const rx = cx + ribbon * w * 0.08 - rw / 2;
    const ry = h * (0.88 + r() * 0.05);
    const tail = `M${n(rx)} ${n(mid)}H${n(rx + rw)}V${n(ry)}L${n(rx + rw / 2)} ${n(ry - rw * 0.6)}L${n(rx)} ${n(ry)}Z`;
    c.add(
      `<g clip-path="url(#${c.clip(`M0 ${n(bot + dip * 0.5)}H${n(w)}V${n(h)}H0Z`)})"><path class="a x sk" stroke-width="2.4" d="${tail}"/></g>`,
    );
    c.add(baseline(w, h * 0.95));
  },

  people(c, r, p) {
    const { w, h } = c;
    const trio = p() < 0.6;
    const front = pick(p, [0, 0, 1, -1]);
    const bot = h * 0.8;
    const bust = (x: number, hy: number, hr: number, S: number) => {
      const sy = hy + hr * 1.35;
      return (
        circlePath(x, hy, hr) +
        `M${n(x - S)} ${n(bot)}V${n(sy + S * 0.55)}Q${n(x - S)} ${n(sy)} ${n(x - S * 0.45)} ${n(sy)}H${n(x + S * 0.45)}Q${n(x + S)} ${n(sy)} ${n(x + S)} ${n(sy + S * 0.55)}V${n(bot)}Z`
      );
    };
    const cx = w * 0.5 + (r() - 0.5) * w * 0.04;
    const spread = trio ? w * 0.34 : w * 0.24;
    const slots = trio ? [-1, 0, 1] : [-0.5, 0.5];
    const lead = trio ? front : front < 0 ? -0.5 : 0.5;
    const hy = h * (0.3 + r() * 0.04);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx: cx + lead * spread, cy: hy, r: w * 1.05, pow: 1.5, amp: 1.1 },
    });
    let main = '';
    for (const s of slots) {
      const x = cx + s * spread;
      if (s === lead) {
        main = bust(x, hy, w * 0.17, w * 0.4);
        continue;
      }
      const d = bust(x, hy - h * 0.03 + r() * h * 0.03, w * 0.13, w * 0.3);
      c.add(`<path class="b x sk" stroke-width="2.8" d="${d}"/>`);
    }
    c.add(`<path class="a x" d="${main}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(main),
      field: { cx: cx + lead * spread + w * 0.4, cy: bot, r: w * 0.9, pow: 1.3, amp: 0.9 },
    });
    c.add(`<path class="sk n" stroke-width="3" d="${main}"/>`);
    c.add(circle(cx + lead * spread + w * 0.42, h * 0.52, w * 0.04, ' class="k"'));
    c.add(baseline(w, bot + h * 0.04));
  },

  scales(c, r, p) {
    const { w, h } = c;
    const tilt = (pick(p, [-1, 1]) * (6 + r() * 8)) / DEG;
    const wide = p() < 0.5;
    const cx = w * 0.5;
    const py = h * (0.17 + r() * 0.04);
    const L = w * (wide ? 0.46 : 0.4);
    const base = h * 0.78;
    const pr = w * 0.23;
    const drop = h * 0.24;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy: py + drop * 0.6, r: w * 1.05, pow: 1.5, amp: 1.1 },
    });
    c.add(rect(cx - w * 0.03, py, w * 0.06, base - py, ' class="k"'));
    c.add(
      `<path class="k" d="${poly([
        [cx - w * 0.2, base],
        [cx + w * 0.2, base],
        [cx + w * 0.26, base + h * 0.05],
        [cx - w * 0.26, base + h * 0.05],
      ])}"/>`,
    );
    let bowls = '';
    let parts = '';
    for (const s of [-1, 1]) {
      const [ex, ey] = polar(cx, py, L, s > 0 ? tilt : tilt + Math.PI);
      const by = ey + drop;
      bowls += `M${n(ex - pr)} ${n(by)}A${n(pr)} ${n(pr * 0.55)} 0 0 0 ${n(ex + pr)} ${n(by)}Z`;
      parts += `<path class="sk n" stroke-width="1.5" d="M${n(ex)} ${n(ey)}L${n(ex - pr)} ${n(by)}M${n(ex)} ${n(ey)}V${n(by)}M${n(ex)} ${n(ey)}L${n(ex + pr)} ${n(by)}"/>`;
      const low = s > 0 === tilt > 0;
      const wr = w * (low ? 0.1 : 0.065);
      parts += circle(ex, by - wr * 0.7, wr, ' class="b x sk" stroke-width="2.4"');
      parts += circle(ex, ey, w * 0.025, ' class="k"');
    }
    c.add(parts);
    c.add(`<path class="a x" d="${bowls}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(bowls),
      field: [{ x1: tilt > 0 ? w : 0, y1: 0, x2: tilt > 0 ? w * 0.3 : w * 0.7, y2: 0, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="2.8" d="${bowls}"/>`);
    const beam = bar(...polar(cx, py, L, tilt + Math.PI), ...polar(cx, py, L, tilt), w * 0.045);
    c.add(`<path class="k" d="${beam}"/>`);
    c.add(circle(cx, py, w * 0.06, ' class="k"') + circle(cx, py, w * 0.022, ' class="p"'));
    c.add(baseline(w, base + h * 0.09));
  },

  magnet(c, r, p) {
    const { w, h } = c;
    const rot = pick(p, [-1, 1]) * (10 + p() * 12);
    const bits = pick(p, [4, 6]);
    const cx = w * 0.5 + (r() - 0.5) * w * 0.06;
    const cy = h * (0.3 + r() * 0.04);
    const Ro = w * 0.45;
    const Ri = w * 0.2;
    const Lg = h * 0.22;
    const th = h * 0.075;
    const m = frame(cx, cy, rot);
    const body = `M${pt(m(-Ro, 0))}A${n(Ro)} ${n(Ro)} 0 0 1 ${pt(m(Ro, 0))}L${pt(m(Ro, Lg))}L${pt(m(Ri, Lg))}L${pt(m(Ri, 0))}A${n(Ri)} ${n(Ri)} 0 0 0 ${pt(m(-Ri, 0))}L${pt(m(-Ri, Lg))}L${pt(m(-Ro, Lg))}Z`;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx: m(0, Lg)[0], cy: m(0, Lg)[1] + h * 0.1, r: w * 0.95, pow: 1.5, amp: 1.1 },
    });
    let field = '';
    for (const t of [0.25, 0.55, 0.85]) {
      const d = Ri + (Ro - Ri) * t;
      field += `M${pt(m(-d, Lg))}A${n(d)} ${n(d)} 0 0 0 ${pt(m(d, Lg))}`;
    }
    c.add(`<path class="sk n" stroke-width="1.5" stroke-dasharray="4 4" d="${field}"/>`);
    let pile = '';
    for (let i = 0; i < bits; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (Ri + (Ro - Ri) * (0.2 + r() * 0.6)) + (r() - 0.5) * w * 0.1;
      const y = Lg + th * 0.6 + r() * h * 0.16;
      const s = w * (0.03 + r() * 0.025);
      const [gx, gy] = m(x, y);
      pile +=
        r() < 0.5
          ? circle(gx, gy, s, ' class="b x sk" stroke-width="2"')
          : `<path class="b x sk" stroke-width="2" d="${rrect(gx - s, gy - s * 0.8, 2 * s, 1.6 * s, s * 0.3)}"/>`;
    }
    c.add(pile);
    c.add(`<path class="a x" d="${body}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(body),
      field: [{ x1: m(Ro, 0)[0], y1: 0, x2: m(-Ro * 0.2, 0)[0], y2: 0, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
    for (const s of [-1, 1]) {
      const tip = poly([m(s * Ro, Lg - th), m(s * Ri, Lg - th), m(s * Ri, Lg), m(s * Ro, Lg)]);
      c.add(`<path class="p sk" stroke-width="2.6" d="${tip}"/>`);
    }
    c.add(baseline(w, h * 0.84));
  },

  megaphone(c, r, p) {
    const { w, h } = c;
    const flip = p() < 0.5;
    const waves = pick(p, [2, 3]);
    const a = h * 0.055;
    const b = h * 0.21;
    const Lc = w * 0.7;
    const m = frame(w * 0.12, h * 0.5 + (r() - 0.5) * h * 0.06, -(14 + r() * 10), flip ? w : 0);
    const cone = poly([m(0, -a), m(Lc, -b), m(Lc, b), m(0, a)]);
    const [mx, my] = m(Lc + w * 0.08, 0);
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.6,
      cls: 'b',
      field: { cx: mx, cy: my, r: w * 0.5, pow: 1.3, amp: 1.05 },
    });
    let arcs = '';
    for (let i = 1; i <= waves; i++) {
      const R = w * (0.12 + i * 0.14);
      const [x1, y1] = m(Lc + R * Math.cos(-0.7), R * Math.sin(-0.7));
      const [x2, y2] = m(Lc + R * Math.cos(0.7), R * Math.sin(0.7));
      arcs += `M${n(x1)} ${n(y1)}A${n(R)} ${n(R)} 0 0 ${flip ? 0 : 1} ${n(x2)} ${n(y2)}`;
    }
    c.add(`<path class="sk n" stroke-width="3.6" stroke-linecap="round" d="${arcs}"/>`);
    c.add(
      `<path class="k" d="${poly([m(w * 0.02, a * 0.8), m(w * 0.17, a * 1.1), m(w * 0.2, a + h * 0.17), m(w * 0.07, a + h * 0.17)])}"/>`,
    );
    c.add(`<path class="a x" d="${cone}"/>`);
    c.add(`<path class="p" d="${poly([m(0, -a * 0.45), m(Lc, -b * 0.5), m(Lc, -b * 0.25), m(0, -a * 0.1)])}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(cone),
      field: [
        {
          x1: m(Lc * 0.5, b)[0],
          y1: m(Lc * 0.5, b)[1],
          x2: m(Lc * 0.5, -b * 0.3)[0],
          y2: m(Lc * 0.5, -b * 0.3)[1],
          amp: 0.7,
        },
      ],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${cone}"/>`);
    c.add(
      `<path class="b x sk" stroke-width="2.6" d="${poly([m(Lc - w * 0.07, -b * 0.93), m(Lc, -b), m(Lc, b), m(Lc - w * 0.07, b * 0.93)])}"/>`,
    );
    c.add(
      `<path class="k" d="${poly([m(-w * 0.09, -a * 1.4), m(w * 0.01, -a * 1.4), m(w * 0.01, a * 1.4), m(-w * 0.09, a * 1.4)])}"/>`,
    );
    c.add(baseline(w, h * 0.84));
  },

  gamepad(c, r, p) {
    const { w, h } = c;
    const inked = p() < 0.5;
    const long = p() < 0.5;
    const cx = w * 0.5;
    const T = h * (0.26 + r() * 0.06);
    const H = h * 0.26;
    const Wd = w * 0.5;
    const GB = T + h * (long ? 0.52 : 0.46);
    const rad = w * 0.1;
    const body =
      `M${n(cx - Wd + rad)} ${n(T)}H${n(cx + Wd - rad)}Q${n(cx + Wd)} ${n(T)} ${n(cx + Wd + w * 0.02)} ${n(T + rad)}` +
      `L${n(cx + Wd + w * 0.05)} ${n(GB - rad * 1.6)}Q${n(cx + Wd + w * 0.05)} ${n(GB)} ${n(cx + Wd - w * 0.12)} ${n(GB)}` +
      `L${n(cx + Wd * 0.45)} ${n(T + H + h * 0.03)}Q${n(cx + Wd * 0.35)} ${n(T + H + h * 0.07)} ${n(cx + Wd * 0.22)} ${n(T + H)}` +
      `H${n(cx - Wd * 0.22)}Q${n(cx - Wd * 0.35)} ${n(T + H + h * 0.07)} ${n(cx - Wd * 0.45)} ${n(T + H + h * 0.03)}` +
      `L${n(cx - Wd + w * 0.12)} ${n(GB)}Q${n(cx - Wd - w * 0.05)} ${n(GB)} ${n(cx - Wd - w * 0.05)} ${n(GB - rad * 1.6)}` +
      `L${n(cx - Wd - w * 0.02)} ${n(T + rad)}Q${n(cx - Wd)} ${n(T)} ${n(cx - Wd + rad)} ${n(T)}Z`;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy: T + H * 0.5, r: w * 1.05, pow: 1.5, amp: 1.1 },
    });
    c.add(`<path class="a x" d="${body}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(body),
      field: [{ x1: 0, y1: GB, x2: 0, y2: T + H * 0.3, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
    const dx = cx - Wd * 0.58;
    const dy = T + H * 0.46;
    const arm = w * 0.055;
    const span = w * 0.16;
    c.add(
      `<path class="k" d="${rrect(dx - span, dy - arm, 2 * span, 2 * arm, arm * 0.4)}${rrect(dx - arm, dy - span, 2 * arm, 2 * span, arm * 0.4)}"/>`,
    );
    const bx = cx + Wd * 0.58;
    const hot = Math.floor(r() * 4);
    let buttons = '';
    for (let i = 0; i < 4; i++) {
      const [x, y] = polar(bx, dy, w * 0.11, (i * TAU) / 4);
      buttons += circle(x, y, w * 0.05, ` class="${i === hot ? 'k' : inked ? 'b x sk' : 'p sk'}" stroke-width="2"`);
    }
    c.add(buttons);
    const sy = T + H * 1.02;
    for (const s of [-1, 1]) {
      c.add(circle(cx + s * Wd * 0.26, sy, w * 0.075, ' class="p sk" stroke-width="2.4"'));
      c.add(circle(cx + s * Wd * 0.26, sy, w * 0.035, ' class="k"'));
      c.add(`<path class="k" d="${rrect(cx + s * w * 0.1 - w * 0.03, T + H * 0.42, w * 0.06, w * 0.03, w * 0.01)}"/>`);
    }
    c.add(baseline(w, GB + h * 0.07));
  },

  truck(c, r, p) {
    const { w, h } = c;
    const X = p() < 0.5 ? (x: number) => w - x : (x: number) => x;
    const band = p() < 0.5;
    const x0 = w * 0.22;
    const y0 = h * (0.2 + r() * 0.06);
    const y1 = h * 0.62;
    const box = poly([
      [X(x0), y0],
      [X(w * 1.08), y0],
      [X(w * 1.08), y1],
      [X(x0), y1],
    ]);
    const cab = poly([
      [X(x0), y1],
      [X(x0), h * 0.36],
      [X(x0 - w * 0.08), h * 0.36],
      [X(x0 - w * 0.2), h * 0.47],
      [X(x0 - w * 0.23), y1],
    ]);
    const puffs = 2 + Math.floor(r() * 2);
    let smoke = '';
    for (let i = 0; i < puffs; i++)
      smoke += circle(
        X(x0 - w * 0.08 - i * w * 0.06),
        h * 0.29 - i * h * 0.05 - r() * h * 0.03,
        w * (0.025 + r() * 0.02),
      );
    c.add(`<g class="k">${smoke}</g>`);
    c.add(`<path class="a x" d="${box}"/>`);
    if (band) c.add(rect(Math.min(X(x0), X(w * 1.08)), y0 + (y1 - y0) * 0.42, w * 0.86, h * 0.05, ' class="p"'));
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(box),
      field: [
        { x1: 0, y1: y1, x2: 0, y2: y0 + (y1 - y0) * 0.3, amp: 0.85 },
        { x1: X(w * 1.08), y1: 0, x2: X(x0 + w * 0.3), y2: 0 },
      ],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${box}"/>`);
    c.add(`<path class="b x sk" stroke-width="3" d="${cab}"/>`);
    c.add(
      `<path class="p" d="${poly([
        [X(x0 - w * 0.065), h * 0.385],
        [X(x0 - w * 0.17), h * 0.475],
        [X(x0 - w * 0.17), h * 0.5],
        [X(x0 - w * 0.03), h * 0.5],
      ])}"/>`,
    );
    c.add(rect(Math.min(X(x0 - w * 0.23), X(w * 1.08)), y1, w * 1.31, w * 0.03, ' class="k"'));
    const wy = y1 + w * 0.04;
    let wheels = '';
    for (const wx of [x0 - w * 0.11, x0 + w * 0.26, x0 + w * 0.46]) {
      wheels += circle(X(wx), wy, w * 0.085, ' class="k"') + circle(X(wx), wy, w * 0.03, ' class="p"');
    }
    c.add(wheels);
    c.add(baseline(w, wy + w * 0.1));
  },

  coins(c, r, p) {
    const { w, h } = c;
    const tallLeft = p() < 0.5;
    const rings = pick(p, [1, 2]);
    const base = h * 0.8;
    const ch = h * 0.065;
    const cw = w * 0.46;
    const counts = [7 + Math.floor(r() * 3), 2 + Math.floor(r() * 2)];
    if (!tallLeft) counts.reverse();
    let stacks = '';
    const tops: number[] = [];
    for (const [i, count] of counts.entries()) {
      const x = w * (0.04 + i * 0.5);
      for (let j = 0; j < count; j++) {
        stacks += rrect(x + (r() - 0.5) * w * 0.03, base - (j + 1) * ch, cw, ch, ch * 0.22);
      }
      tops.push(base - count * ch);
    }
    const fi = tallLeft ? 1 : 0;
    const fx = w * (0.04 + fi * 0.5) + cw * 0.5;
    const fr = w * 0.22;
    const fy = tops[fi] - fr * 0.92;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx: w * 0.5, cy: base - h * 0.15, r: w * 1.05, pow: 1.5, amp: 1.1 },
    });
    c.add(`<path class="a x sk" stroke-width="2.4" d="${stacks}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(stacks),
      field: [{ x1: 0, y1: 0, x2: w * 0.55, y2: 0, amp: 0.7 }],
    });
    let face = circle(fx, fy, fr, ' class="b x sk" stroke-width="3"');
    for (let i = 1; i <= rings; i++) face += circle(fx, fy, fr * (1 - i * 0.18), ' class="sk n" stroke-width="1.3"');
    face += `<path class="p" d="${star(fx, fy, fr * 0.42, fr * 0.2, 5, -TAU / 4)}"/>`;
    c.add(face);
    c.add(circle(w * (tallLeft ? 0.9 : 0.1), h * 0.1, w * 0.04, ' class="k"'));
    c.add(baseline(w, base + h * 0.03));
  },

  sparkle(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const tiny = pick(p, [2, 4]);
    const cx = w * (0.5 - side * 0.08);
    const cy = h * (0.4 + r() * 0.06);
    const R = w * 0.5;
    const phase = ((r() - 0.5) * 16) / DEG - TAU / 4;
    const big = spark(cx, cy, R, phase);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.7,
      cls: 'a',
      field: { cx, cy, r: w * 0.85, pow: 1.3, amp: 1.15 },
    });
    const sx = cx + side * w * 0.36;
    const sy = cy - h * 0.3;
    c.add(`<path class="b x sk" stroke-width="2.6" d="${spark(sx, sy, w * 0.2, -TAU / 4)}"/>`);
    c.add(`<path class="p" d="${spark(sx, sy, w * 0.07, -TAU / 4)}"/>`);
    c.add(`<path class="a x" d="${big}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(big),
      field: { cx: cx - side * R * 0.5, cy: cy + R * 0.6, r: R * 1.1, pow: 1.3, amp: 0.9 },
    });
    c.add(`<path class="sk n" stroke-width="3" d="${big}"/>`);
    c.add(`<path class="k" d="${spark(cx - side * w * 0.3, cy + h * 0.3, w * 0.09, -TAU / 4)}"/>`);
    let dots = '';
    for (let i = 0; i < tiny; i++) dots += circle(w * r(), h * (0.05 + r() * 0.75), w * (0.012 + r() * 0.015));
    c.add(`<g class="k">${dots}</g>`);
    c.add(baseline(w, h * 0.82));
  },

  a11y(c, r, p) {
    const { w, h } = c;
    const shift = pick(p, [-1, 1]);
    const halo = p() < 0.5;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.04;
    const cy = h * (0.38 + r() * 0.05);
    const R = w * 0.46;
    const disc = circlePath(cx, cy, R);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy, r: w * 1.05, pow: 1.5, amp: 1.1 },
    });
    if (halo) c.add(circle(cx, cy, R * 1.12, ' class="sk n" stroke-width="1.3" stroke-dasharray="4 4"'));
    c.add(circle(cx + shift * R * 0.12, cy + R * 0.08, R, ' class="b x"'));
    c.add(`<path class="a x" d="${disc}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(disc),
      field: { cx: cx - shift * R * 0.7, cy: cy + R * 0.7, r: R * 1.5, pow: 1.3, amp: 0.9 },
    });
    c.add(`<path class="sk n" stroke-width="3.2" d="${disc}"/>`);
    const t = R * 0.15;
    const lift = (r() - 0.5) * R * 0.16;
    const arms =
      bar(cx - R * 0.72, cy - R * 0.22 + lift, cx, cy - R * 0.3, t) +
      bar(cx, cy - R * 0.3, cx + R * 0.72, cy - R * 0.22 - lift, t);
    const legs =
      bar(cx, cy + R * 0.02, cx - R * 0.36, cy + R * 0.72, t) + bar(cx, cy + R * 0.02, cx + R * 0.36, cy + R * 0.72, t);
    const torso = bar(cx, cy - R * 0.3, cx, cy + R * 0.02, t * 1.3);
    const figure = arms + legs + torso + circlePath(cx, cy - R * 0.6, R * 0.17);
    c.add(`<path class="k sk" stroke-width="5" stroke-linejoin="round" d="${figure}"/><path class="p" d="${figure}"/>`);
    c.add(baseline(w, cy + R * 1.25));
  },

  trophy(c, r, p) {
    const { w, h } = c;
    const round = p() < 0.5;
    const emblem = p() < 0.5;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.04;
    const T = h * (0.1 + r() * 0.04);
    const Wc = w * 0.3;
    const D = h * 0.36;
    const B = h * 0.68;
    const cup = `M${n(cx - Wc)} ${n(T)}H${n(cx + Wc)}V${n(T + D * 0.4)}Q${n(cx + Wc)} ${n(T + D)} ${n(cx + Wc * 0.15)} ${n(T + D)}H${n(cx - Wc * 0.15)}Q${n(cx - Wc)} ${n(T + D)} ${n(cx - Wc)} ${n(T + D * 0.4)}Z`;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy: T + D * 0.5, r: w * 1.0, pow: 1.5, amp: 1.1 },
    });
    let confetti = '';
    const bits = 5 + Math.floor(r() * 4);
    for (let i = 0; i < bits; i++) {
      const x = w * r();
      const y = h * (0.03 + r() * 0.5);
      if (Math.abs(x - cx) < Wc * 1.5 && y > T - h * 0.03 && y < T + D) continue;
      confetti += `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(r() * 180)})"><path class="b x sk" stroke-width="1.6" d="${rrect(-w * 0.035, -w * 0.018, w * 0.07, w * 0.036, w * 0.008)}"/></g>`;
      confetti += circle(x + w * 0.1, y + h * 0.04, w * 0.012, ' class="k"');
    }
    c.add(confetti);
    const hy0 = T + h * 0.04;
    const hy1 = T + D * 0.6;
    let handles = '';
    for (const s of [-1, 1]) {
      const x = cx + s * Wc;
      handles += round
        ? `M${n(x)} ${n(hy0)}A${n(w * 0.2)} ${n((hy1 - hy0) * 0.55)} 0 0 ${s > 0 ? 1 : 0} ${n(x)} ${n(hy1)}`
        : `M${n(x)} ${n(hy0)}L${n(x + s * w * 0.17)} ${n(hy0 + h * 0.03)}L${n(x + s * w * 0.17)} ${n(hy1 - h * 0.03)}L${n(x)} ${n(hy1)}`;
    }
    c.add(`<path class="sk n" stroke-width="${n(w * 0.07)}" stroke-linejoin="round" d="${handles}"/>`);
    c.add(`<path class="sa n x" stroke-width="${n(w * 0.045)}" stroke-linejoin="round" d="${handles}"/>`);
    c.add(`<path class="a x" d="${cup}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(cup),
      field: [{ x1: cx + Wc, y1: 0, x2: cx - Wc * 0.3, y2: 0, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${cup}"/>`);
    c.add(rect(cx - Wc - w * 0.03, T - h * 0.02, 2 * Wc + w * 0.06, h * 0.045, ' class="k"'));
    const ey = T + D * 0.5;
    c.add(
      emblem
        ? `<path class="p sk" stroke-width="2.2" stroke-linejoin="round" d="${star(cx, ey, w * 0.13, w * 0.055, 5, -TAU / 4)}"/>`
        : circle(cx, ey, w * 0.1, ' class="p sk" stroke-width="2.2"') + circle(cx, ey, w * 0.04, ' class="k"'),
    );
    c.add(rect(cx - w * 0.05, T + D - 2, w * 0.1, B - T - D + 2, ' class="k"'));
    c.add(
      `<path class="k" d="${poly([
        [cx - w * 0.22, B],
        [cx + w * 0.22, B],
        [cx + w * 0.3, h * 0.78],
        [cx - w * 0.3, h * 0.78],
      ])}"/>`,
    );
    c.add(rect(cx - w * 0.11, B + h * 0.035, w * 0.22, h * 0.03, ' class="p"'));
    c.add(baseline(w, h * 0.84));
  },

  leaf(c, r, p) {
    const { w, h } = c;
    const X = p() < 0.5 ? (x: number) => w - x : (x: number) => x;
    const twin = p() < 0.5;
    const base: Point = [X(w * 0.1), h * (0.8 + r() * 0.04)];
    const tip: Point = [X(w * 0.96), h * (0.06 + r() * 0.06)];
    const bulge = w * (0.5 + r() * 0.1);
    const skew = (r() - 0.5) * 0.16;
    const blade = leaf(base, tip, bulge, skew);
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.6,
      cls: 'b',
      field: { cx: X(w * 0.2), cy: h * 0.72, r: w * 0.85, pow: 1.4, amp: 1.05 },
    });
    if (twin) {
      const small = leaf(base, [X(w * 0.2), h * 0.1], w * 0.24, 0);
      c.add(`<path class="b x sk" stroke-width="2.8" d="${small}"/>`);
      c.add(`<path class="sk n" stroke-width="1.6" d="M${pt(base)}L${n(X(w * 0.2))} ${n(h * 0.1)}"/>`);
    }
    c.add(`<path class="a x" d="${blade}"/>`);
    const ux = tip[0] - base[0];
    const uy = tip[1] - base[1];
    const len = Math.hypot(ux, uy);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(blade),
      field: [
        {
          x1: base[0] - (uy / len) * bulge * 0.5,
          y1: base[1] + (ux / len) * bulge * 0.5,
          x2: tip[0],
          y2: tip[1],
          amp: 0.85,
        },
      ],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${blade}"/>`);
    const ang = Math.atan2(uy, ux);
    let veins = '';
    const count = pick(p, [5, 7]);
    for (let i = 1; i <= count; i++) {
      const t = (i / (count + 1)) * 0.85 + 0.05;
      const ox = base[0] + ux * t;
      const oy = base[1] + uy * t;
      const reach = bulge * 0.5 * 4 * t * (1 - t) * 0.95;
      for (const s of [-1, 1]) {
        const [vx, vy] = polar(ox, oy, reach, ang + s * 0.95);
        veins += `M${n(ox)} ${n(oy)}Q${n(ox + ux * 0.04)} ${n(oy + uy * 0.04)} ${n(vx)} ${n(vy)}`;
      }
    }
    c.add(`<path class="sk n" stroke-width="1.3" d="${veins}"/>`);
    c.add(`<path class="sk n" stroke-width="2.8" d="M${n(base[0] - ux * 0.1)} ${n(base[1] - uy * 0.1)}L${pt(tip)}"/>`);
    c.add(baseline(w, h * 0.9));
  },
};

/** Words in a project id or name that make a motif the natural pick for that team (lowercase, single words). */
export const BUSINESS_KEYWORDS: Record<string, string[]> = {
  book: ['docs', 'documentation', 'wiki', 'knowledge', 'writing', 'handbook'],
  people: ['hr', 'people', 'talent', 'recruiting', 'hiring', 'onboarding'],
  scales: ['legal', 'policy', 'governance', 'regulatory', 'ethics', 'contracts'],
  magnet: ['sales', 'crm', 'revenue', 'leads', 'deals', 'quota'],
  megaphone: ['ads', 'advertising', 'campaigns', 'pr', 'outreach', 'social', 'communications', 'press'],
  gamepad: ['games', 'gaming', 'gameplay', 'esports', 'studio', 'play'],
  truck: ['logistics', 'shipping', 'fulfillment', 'supply', 'fleet', 'dispatch'],
  coins: ['cost', 'budget', 'procurement', 'spend', 'pricing', 'invoicing', 'monetization'],
  sparkle: ['recommendations', 'personalization', 'recs', 'feed', 'assist'],
  a11y: ['a11y', 'accessibility', 'inclusive', 'inclusion', 'assistive', 'wcag'],
  trophy: ['loyalty', 'rewards', 'gamification', 'achievements', 'engagement', 'retention'],
  leaf: ['sustainability', 'green', 'esg', 'climate', 'carbon', 'energy'],
};
