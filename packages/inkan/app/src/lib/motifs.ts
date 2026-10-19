import { Canvas, TAU, DEG, n, circle } from './canvas';

/**
 * Draws one cover. `r` is seeded by the record, so every record differs;
 * `p` is seeded by the project, for the choices a team's covers share.
 */
export type MotifFn = (c: Canvas, r: () => number, p: () => number) => void;

export const pick = <T>(gen: () => number, options: readonly T[]) => options[Math.floor(gen() * options.length)];
export const mirrorX = (w: number, markup: string) => `<g transform="matrix(-1 0 0 1 ${n(w)} 0)">${markup}</g>`;
export const rect = (x: number, y: number, w: number, h: number, attrs = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${attrs}/>`;
export const circlePath = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;

export const BUILTIN_MOTIFS: Record<string, MotifFn> = {
  rings(c, r, p) {
    const { w, h } = c;
    const thick = pick(p, [5, 8]);
    const span = 0.9 + p() * 0.6;
    const cx = w * (0.34 + r() * 0.36);
    const cy = h * (0.27 + r() * 0.1);
    const step = w * (0.07 + r() * 0.03);
    c.halftone({ spacing: 5.2, angle: 0.3, maxR: 2.9, cls: 'a', field: { cx, cy, r: w * 1.05, pow: 1.5, amp: 1.15 } });
    for (let i = 12; i >= 3; i -= 3) c.add(circle(cx, cy, (i - 0.5) * step, ` class="sa n x" stroke-width="${n(step)}"`));
    let fine = '';
    for (let i = 1; i <= 15; i++) fine += circle(cx, cy, i * step * 0.98);
    c.add(`<g class="sk n" stroke-width="1.1">${fine}</g>`);
    c.add(circle(cx, cy, thick * step, ' class="sk n" stroke-width="3.4"'));
    c.add(`<path class="sk n" stroke-width="1.2" d="M${n(cx)} 0V${n(h)}M0 ${n(cy)}H${n(w)}"/>`);
    const a0 = r() * TAU;
    const R = step * 9;
    const x1 = cx + Math.cos(a0) * R;
    const y1 = cy + Math.sin(a0) * R;
    const x2 = cx + Math.cos(a0 + span) * R;
    const y2 = cy + Math.sin(a0 + span) * R;
    c.add(
      `<path class="b x" fill-opacity=".9" d="M${n(cx)} ${n(cy)}L${n(x1)} ${n(y1)}A${n(R)} ${n(R)} 0 0 1 ${n(x2)} ${n(y2)}Z"/>`,
    );
    const ba = a0 + span * 0.55;
    const bd = step * 6.5;
    c.add(circle(cx + Math.cos(ba) * bd, cy + Math.sin(ba) * bd, w * 0.034, ' class="k"'));
  },

  ticker(c, r, p) {
    const { w, h } = c;
    const ragged = p() < 0.5;
    const coinRings = pick(p, [6, 3]);
    let y = -2;
    let stripes = '';
    while (y < h * 0.66) {
      const bh = 3 + Math.floor(r() * 15);
      const gap = 2 + Math.floor(r() * 7);
      const x0 = r() < 0.4 ? w * r() * 0.3 : 0;
      const x1 = r() < 0.4 ? w * (1 - r() * 0.35) : w;
      const cls = r() < 0.6 ? 'a x' : 'k';
      stripes += `<rect class="${cls}" x="${n(x0)}" y="${n(y)}" width="${n(x1 - x0)}" height="${bh}"/>`;
      y += bh + gap;
    }
    c.add(ragged ? mirrorX(w, stripes) : stripes);
    const cx = w * (0.55 + r() * 0.22);
    const cy = h * (0.27 + r() * 0.07);
    const R = w * 0.3;
    c.add(circle(cx, cy, R, ' class="b x"'));
    let rings = '';
    for (let i = 1; i <= coinRings; i++) rings += circle(cx, cy, (R * i) / (coinRings + 0.5));
    c.add(`<g class="sk n" stroke-width="1.2">${rings}</g>`);
    c.add(circle(cx, cy, R, ' class="sk n" stroke-width="3.2"'));
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.7)}H${n(w)}"/>`);
    c.halftone({
      spacing: 5,
      angle: 0.5,
      maxR: 2.2,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.45, x2: 0, y2: 0, amp: 0.9 },
        ragged ? { x1: w, y1: 0, x2: w * 0.4, y2: 0 } : { x1: 0, y1: 0, x2: w * 0.6, y2: 0 },
      ],
    });
  },

  lattice(c, r, p) {
    const { w, h } = c;
    const spin = pick(p, [1, -1]);
    const shadeLeft = p() < 0.5;
    const cols = 7;
    const rows = 11;
    const gx = w / cols;
    const gy = (h * 0.74) / rows;
    let cells = '';
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() < 0.2) cells += rect(gx * i + 2, gy * j + 2, gx - 4, gy - 4);
      }
    }
    c.add(`<g class="a x">${cells}</g>`);
    // Crosses at every grid intersection: one tile with a cross in each corner.
    const pid = c.id();
    const cross = (x: number, y: number) => `M${n(x - 4.5)} ${n(y)}h9M${n(x)} ${n(y - 4.5)}v9`;
    c.defs.push(
      `<pattern id="${pid}" width="${n(gx)}" height="${n(gy)}" patternUnits="userSpaceOnUse"><path class="sk n" stroke-width="1.2" d="${cross(0, 0)}${cross(gx, 0)}${cross(0, gy)}${cross(gx, gy)}"/></pattern>`,
    );
    c.add(rect(-4.5, -4.5, w + 9, h * 0.74 + 9, ` fill="url(#${pid})"`));
    const tx = w * (0.4 + r() * 0.3);
    const ty = h * (0.3 + r() * 0.08);
    const rot = spin * (0.4 + r() * 0.5) * DEG;
    const S = w * 0.46;
    let lines = '';
    for (let k = 1; k < 6; k++) lines += `M${n(-S / 2)} ${n(-S / 2 + (S * k) / 6)}h${n(S)}`;
    c.add(
      `<g transform="translate(${n(tx)} ${n(ty)}) rotate(${n(rot)})"><rect class="b x" fill-opacity=".92" x="${n(-S / 2)}" y="${n(-S / 2)}" width="${n(S)}" height="${n(S)}"/><rect class="sk n" stroke-width="3" x="${n(-S / 2)}" y="${n(-S / 2)}" width="${n(S)}" height="${n(S)}"/><path class="sk n" stroke-width="1.1" d="${lines}"/></g>`,
    );
    c.halftone({
      spacing: 5,
      angle: 0.8,
      maxR: 2.1,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.55, x2: 0, y2: h * 0.05, amp: 0.9 },
        shadeLeft ? { x1: w, y1: 0, x2: w * 0.35, y2: 0 } : { x1: 0, y1: 0, x2: w * 0.65, y2: 0 },
      ],
    });
  },

  discs(c, r, p) {
    const { w, h } = c;
    const lean = pick(p, [1, -1]);
    const solidRails = p() < 0.5;
    const rx = w * 0.34;
    const ry = w * 0.085;
    const x0 = w * (0.42 + r() * 0.16);
    const top = h * 0.06;
    const gap = h * 0.095;
    const th = h * 0.065;
    for (let i = 4; i >= 0; i--) {
      const cy = top + gap * i + ry;
      const cx = x0 + lean * (r() - 0.5) * w * 0.12;
      const arc = `A${n(rx)} ${n(ry)} 0 0 1`;
      const body = `M${n(cx + rx)} ${n(cy + th)}${arc} ${n(cx - rx)} ${n(cy + th)}L${n(cx - rx)} ${n(cy)}${arc} ${n(cx + rx)} ${n(cy)}Z`;
      c.add(`<path class="${i % 2 ? 'a' : 'b'} x sk" stroke-width="1.5" d="${body}"/>`);
      c.add(
        `<ellipse class="p x sk" stroke-width="2.4" cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/><ellipse class="sk n" stroke-width="1" cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx * 0.62)}" ry="${n(ry * 0.62)}"/>`,
      );
      c.halftone({
        spacing: 4,
        angle: 0.7,
        maxR: 1.5,
        cls: 'k',
        clip: c.clip(body),
        field: [
          lean > 0
            ? { x1: cx + w * 0.34, y1: 0, x2: cx - w * 0.1, y2: 0, amp: 0.8 }
            : { x1: cx - w * 0.34, y1: 0, x2: cx + w * 0.1, y2: 0, amp: 0.8 },
        ],
      });
    }
    c.add(
      `<path class="sk n" stroke-width="1.2"${solidRails ? '' : ' stroke-dasharray="3 4"'} d="M${n(w * 0.1)} 0V${n(h)}M${n(w * 0.9)} 0V${n(h)}"/>`,
    );
  },

  arcs(c, r, p) {
    const { w, h } = c;
    const thick = pick(p, [4, 7]);
    const phase = pick(p, [0, 1]);
    const ox = r() < 0.5 ? 0 : w;
    const oy = h * (0.5 + r() * 0.1);
    let fills = '';
    for (let i = 9; i >= 1; i--) {
      fills += circle(ox, oy, i * w * 0.12, (i + phase) % 2 ? ' class="a x"' : ' class="b x" fill-opacity=".85"');
    }
    c.add(fills);
    let rings = '';
    for (let i = 1; i <= 10; i++) rings += circle(ox, oy, i * w * 0.12);
    c.add(`<g class="sk n" stroke-width="1.2">${rings}</g>`);
    c.add(circle(ox, oy, w * 0.12 * thick, ' class="sk n" stroke-width="3.6"'));
    const px = w * (0.18 + r() * 0.3);
    const py = h * (0.12 + r() * 0.08);
    c.add(
      `<rect class="k" x="${n(px)}" y="${n(py)}" width="${n(w * 0.34)}" height="${n(w * 0.1)}" rx="${n(w * 0.05)}"/>${circle(px + w * 0.05, py + w * 0.05, w * 0.03, ' class="p x"')}`,
    );
    let dots = '';
    for (let i = 0; i < 6; i++) dots += circle(w * 0.12 + i * 9, h * 0.04 + w * 0.02, 2.4);
    c.add(`<g class="k">${dots}</g>`);
    c.halftone({
      spacing: 5,
      angle: 0.2,
      maxR: 2.2,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.5, x2: 0, y2: 0, amp: 0.8 },
        ox === 0 ? { x1: w, y1: 0, x2: w * 0.3, y2: 0 } : { x1: 0, y1: 0, x2: w * 0.7, y2: 0 },
      ],
    });
  },

  chevrons(c, r, p) {
    const { w, h } = c;
    const up = p() < 0.5;
    const depth = w * (0.22 + p() * 0.14) * (up ? 1 : -1);
    const t = h * 0.075;
    const pitch = t + h * 0.035;
    const cx = w * (0.4 + r() * 0.2);
    const accent = 2 + Math.floor(r() * 3);
    const dark = accent + 2 + Math.floor(r() * 2);
    let bands = '';
    let blip = '';
    for (let i = 0, y = -Math.abs(depth) + r() * pitch; y < h * 0.8; i++, y += pitch) {
      const cls = i === accent ? 'b x' : i === dark ? 'k' : 'a x';
      bands += `<path class="${cls} sk" stroke-width="1.4" d="M0 ${n(y)}L${n(cx)} ${n(y - depth)}L${n(w)} ${n(y)}v${n(t)}L${n(cx)} ${n(y + t - depth)}L0 ${n(y + t)}Z"/>`;
      if (i === accent) blip = circle(cx, y + t / 2 - depth, w * 0.045, ' class="k"');
    }
    c.add(bands + blip);
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M${n(cx)} 0V${n(h)}"/>`);
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.2,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.6, x2: 0, y2: h * 0.1, amp: 0.85 },
        { x1: cx, y1: 0, x2: cx > w / 2 ? 0 : w, y2: 0 },
      ],
    });
  },

  waves(c, r, p) {
    const { w, h } = c;
    const lam = w / pick(p, [1.5, 2.5]);
    const amp = h * (0.028 + p() * 0.022);
    const sunX = w * (0.25 + r() * 0.5);
    const sunY = h * (0.1 + r() * 0.1);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.4, cls: 'a', field: { cx: sunX, cy: sunY, r: w * 0.7, pow: 1.4, amp: 1 } });
    c.add(circle(sunX, sunY, w * 0.19, ' class="b x"') + circle(sunX, sunY, w * 0.19, ' class="sk n" stroke-width="3"'));
    const classes = ['a x', 'p', 'b x', 'p', 'a x', 'p', 'k'];
    for (let i = 0; i < classes.length; i++) {
      const y0 = h * (0.24 + i * 0.09);
      let d = '';
      let sign = r() < 0.5 ? 1 : -1;
      for (let x = -lam + r() * lam; x < w + lam; x += lam / 2) {
        d += d ? `Q${n(x + lam / 4)} ${n(y0 + sign * 2 * amp)} ${n(x + lam / 2)} ${n(y0)}` : `M${n(x)} ${n(y0)}`;
        sign = -sign;
      }
      c.add(`<path class="${classes[i]} sk" stroke-width="1.5" d="${d}V${n(h + 10)}H${n(-lam)}Z"/>`);
    }
  },

  sunburst(c, r, p) {
    const { w, h } = c;
    const ox = w * pick(p, [0.18, 0.82]);
    const rays = pick(p, [14, 22]);
    const oy = h * (0.2 + r() * 0.14);
    const R = Math.hypot(w, h);
    const a0 = r() * TAU;
    let d = '';
    for (let i = 0; i < rays; i++) {
      const t0 = a0 + (i * TAU) / rays;
      const t1 = t0 + TAU / rays / 2;
      d += `M${n(ox)} ${n(oy)}L${n(ox + Math.cos(t0) * R)} ${n(oy + Math.sin(t0) * R)}L${n(ox + Math.cos(t1) * R)} ${n(oy + Math.sin(t1) * R)}Z`;
    }
    c.add(`<path class="a x" d="${d}"/>`);
    c.halftone({ spacing: 5, angle: 0.5, maxR: 2.3, cls: 'k', field: { cx: ox, cy: oy, r: w * 0.95, pow: 2, amp: 0.9 } });
    const disc = w * (0.22 + r() * 0.06);
    c.add(circle(ox, oy, disc, ' class="b x"') + circle(ox, oy, disc, ' class="sk n" stroke-width="3.4"'));
    c.add(circle(ox, oy, disc * 0.5, ' class="sk n" stroke-width="1.2"') + circle(ox, oy, w * 0.04, ' class="k"'));
    const hy = h * (0.6 + r() * 0.1);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(hy)}H${n(w)}"/>`);
  },

  bricks(c, r, p) {
    const { w, h } = c;
    const cols = pick(p, [3, 4]);
    const bw = w / cols;
    const bh = h * (0.065 + p() * 0.025);
    const rows = Math.ceil((h * 0.78) / bh);
    const fills: Record<string, string> = { 'a x': '', 'b x': '', k: '' };
    for (let j = 0; j < rows; j++) {
      const off = j % 2 ? bw / 2 : 0;
      for (let i = -1; i < cols; i++) {
        const v = r();
        const cls = v < 0.4 ? 'a x' : v < 0.52 ? 'b x' : v < 0.58 ? 'k' : '';
        if (cls) fills[cls] += rect(i * bw + off + 1.5, j * bh + 1.5, bw - 3, bh - 3);
      }
    }
    for (const [cls, cells] of Object.entries(fills)) c.add(`<g class="${cls}">${cells}</g>`);
    const pid = c.id();
    c.defs.push(
      `<pattern id="${pid}" width="${n(bw)}" height="${n(bh * 2)}" patternUnits="userSpaceOnUse"><path class="sk n" stroke-width="1.4" d="M0 0H${n(bw)}M0 ${n(bh)}H${n(bw)}M0 0V${n(bh)}M${n(bw / 2)} ${n(bh)}V${n(bh * 2)}"/></pattern>`,
    );
    c.add(rect(0, 0, w, rows * bh, ` fill="url(#${pid})"`));
    c.add(`<path class="sk n" stroke-width="2.4" d="M0 ${n(rows * bh)}H${n(w)}"/>`);
    const cx = w * (0.3 + r() * 0.4);
    const cy = h * (0.25 + r() * 0.15);
    c.add(circle(cx, cy, w * 0.2, ' class="b x" fill-opacity=".9"') + circle(cx, cy, w * 0.2, ' class="sk n" stroke-width="3"'));
    c.halftone({
      spacing: 5,
      angle: 0.6,
      maxR: 2.1,
      cls: 'k',
      field: [{ x1: 0, y1: h * 0.15, x2: 0, y2: h * 0.75, amp: 0.85 }],
    });
  },

  bars(c, r, p) {
    const { w, h } = c;
    const count = pick(p, [6, 9]);
    const hang = p() < 0.5;
    const base = hang ? h * 0.06 : h * 0.74;
    const bw = w / count;
    const gap = bw * 0.22;
    const hi = Math.floor(r() * count);
    const dk = (hi + 1 + Math.floor(r() * (count - 1))) % count;
    let bars = '';
    let marker = '';
    for (let i = 0; i < count; i++) {
      const len = h * (0.12 + r() * 0.5);
      const y = hang ? base : base - len;
      const cls = i === hi ? 'b x' : i === dk ? 'k' : 'a x';
      bars += rect(i * bw + gap / 2, y, bw - gap, len, ` class="${cls} sk" stroke-width="1.3"`);
      if (i === hi) marker = circle(i * bw + bw / 2, hang ? y + len : y, bw * 0.4, ' class="k"');
    }
    let grid = '';
    for (let k = 1; k <= 5; k++) grid += `M0 ${n(hang ? base + k * h * 0.12 : base - k * h * 0.12)}H${n(w)}`;
    c.add(`<path class="sk n" stroke-width="1.1" stroke-dasharray="2 4" d="${grid}"/>`);
    c.add(bars + marker);
    c.add(`<path class="sk n" stroke-width="2.6" d="M0 ${n(base)}H${n(w)}"/>`);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.2,
      cls: 'k',
      field: [
        hang ? { x1: 0, y1: h * 0.1, x2: 0, y2: h * 0.6, amp: 0.85 } : { x1: 0, y1: h * 0.7, x2: 0, y2: h * 0.2, amp: 0.85 },
        { x1: hi * bw, y1: 0, x2: hi < count / 2 ? w : 0, y2: 0 },
      ],
    });
  },

  orbit(c, r, p) {
    const { w, h } = c;
    const tilt = pick(p, [-1, 1]) * (14 + p() * 14);
    const moonSide = pick(p, [-1, 1]);
    const cx = w * (0.4 + r() * 0.2);
    const cy = h * (0.3 + r() * 0.08);
    const R = w * 0.32;
    const rx = w * 0.6;
    const ry = w * 0.15;
    const band = `<path class="a x sk" stroke-width="1.2" fill-rule="evenodd" d="M${n(-rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0ZM${n(-rx * 0.76)} 0a${n(rx * 0.76)} ${n(ry * 0.76)} 0 1 0 ${n(2 * rx * 0.76)} 0a${n(rx * 0.76)} ${n(ry * 0.76)} 0 1 0 ${n(-2 * rx * 0.76)} 0Z"/>`;
    const place = `translate(${n(cx)} ${n(cy)}) rotate(${n(tilt)})`;
    let stars = '';
    for (let i = 0; i < 7; i++) stars += circle(r() * w, r() * h * 0.7, 1.6 + r() * 1.8);
    c.add(`<g class="k">${stars}</g>`);
    c.add(`<g transform="${place}">${band}</g>`);
    c.add(circle(cx, cy, R, ' class="b x"'));
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(circlePath(cx, cy, R)),
      field: { cx: cx + moonSide * R * 0.7, cy: cy + R * 0.6, r: R * 1.7, pow: 1.2, amp: 0.95 },
    });
    c.add(circle(cx, cy, R, ' class="sk n" stroke-width="3"'));
    const front = c.clip(`M${n(-rx - 6)} 0H${n(rx + 6)}V${n(ry + 6)}H${n(-rx - 6)}Z`);
    c.add(`<g transform="${place}"><g clip-path="url(#${front})">${band}</g></g>`);
    const ma = moonSide > 0 ? 0.3 : Math.PI - 0.3;
    c.add(`<g transform="${place}">${circle(Math.cos(ma) * rx * 0.88, Math.sin(ma) * ry * 0.88, w * 0.05, ' class="k"')}</g>`);
  },

  contour(c, r, p) {
    const { w, h } = c;
    const cx = w * pick(p, [0.32, 0.68]) + (r() - 0.5) * w * 0.1;
    const lobes = pick(p, [3, 5]);
    const cy = h * (0.28 + r() * 0.12);
    const f1 = r() * TAU;
    const f2 = r() * TAU;
    const levels = 7;
    const Rmax = w * 0.66;
    const shape = (t: number) => 1 + 0.13 * Math.sin(lobes * t + f1) + 0.06 * Math.sin((lobes + 2) * t + f2);
    const classes = ['k', 'a x', 'n', 'b x', 'n', 'a x', 'n'];
    for (let k = levels; k >= 1; k--) {
      const R = (Rmax * k) / levels;
      let d = '';
      for (let i = 0; i < 28; i++) {
        const t = (i / 28) * TAU;
        const rr = R * shape(t);
        d += `${i ? 'L' : 'M'}${n(cx + Math.cos(t) * rr)} ${n(cy + Math.sin(t) * rr)}`;
      }
      c.add(`<path class="${classes[k - 1]} sk" stroke-width="${k === 4 ? 3 : 1.2}" d="${d}Z"/>`);
    }
    c.add(
      `<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M${n(cx)} ${n(cy)}L${n(cx > w / 2 ? 0 : w)} ${n(h * 0.78)}"/>`,
    );
    c.halftone({
      spacing: 5,
      angle: 0.9,
      maxR: 2.2,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.1, x2: 0, y2: h * 0.75, amp: 0.8 },
        { x1: cx, y1: 0, x2: cx > w / 2 ? 0 : w, y2: 0 },
      ],
    });
  },

  checker(c, r, p) {
    const { w, h } = c;
    const s = w / pick(p, [4, 6]);
    const rot = (p() - 0.5) * 50;
    const pid = c.id();
    c.defs.push(
      `<pattern id="${pid}" width="${n(2 * s)}" height="${n(2 * s)}" patternUnits="userSpaceOnUse" patternTransform="rotate(${n(rot)} ${n(w / 2)} ${n(h / 2)})"><g class="a x">${rect(0, 0, s, s)}${rect(s, s, s, s)}</g></pattern>`,
    );
    c.add(rect(0, 0, w, h * 0.82, ` fill="url(#${pid})"`));
    c.add(`<path class="sk n" stroke-width="2.4" d="M0 ${n(h * 0.82)}H${n(w)}"/>`);
    const cx = w * (0.3 + r() * 0.4);
    const cy = h * (0.25 + r() * 0.15);
    const R = w * 0.25;
    c.add(circle(cx, cy, R, ' class="b x"') + circle(cx, cy, R, ' class="sk n" stroke-width="3.4"'));
    const sh = r() * TAU;
    c.add(circle(cx + Math.cos(sh) * R * 0.55, cy + Math.sin(sh) * R * 0.55, R * 0.4, ' class="k"'));
    c.halftone({
      spacing: 5,
      angle: 0.7,
      maxR: 2.1,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.65, x2: 0, y2: h * 0.05, amp: 0.8 },
        { x1: cx, y1: 0, x2: cx > w / 2 ? 0 : w, y2: 0 },
      ],
    });
  },

  cubes(c, r, p) {
    const { w, h } = c;
    const lit = p() < 0.5;
    const stair = p() < 0.5;
    const s = w * 0.22;
    const dx = s * 0.866;
    const dy = s * 0.5;
    const ox = w * (0.45 + r() * 0.1);
    const oy = h * (0.26 + r() * 0.08);
    const cells: [number, number, number][] = stair
      ? [
          [0, 0, 0],
          [1, 0, 0],
          [1, 0, 1],
          [2, 0, 0],
          [2, 0, 1],
          [2, 0, 2],
          [0, 1, 0],
          [1, 1, 0],
        ]
      : [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [1, 1, 0],
          [0.5, 0.5, 1],
          [r() < 0.5 ? 0 : 1, 0, 1],
        ];
    let out = '';
    for (const [i, j, k] of cells) {
      const x = ox + (i - j) * dx;
      const y = oy + (i + j) * dy - k * s;
      const left = `M${n(x - dx)} ${n(y + dy)}L${n(x)} ${n(y + 2 * dy)}v${n(s)}L${n(x - dx)} ${n(y + dy + s)}Z`;
      const right = `M${n(x + dx)} ${n(y + dy)}L${n(x)} ${n(y + 2 * dy)}v${n(s)}L${n(x + dx)} ${n(y + dy + s)}Z`;
      const top = `M${n(x)} ${n(y)}L${n(x + dx)} ${n(y + dy)}L${n(x)} ${n(y + 2 * dy)}L${n(x - dx)} ${n(y + dy)}Z`;
      out += `<path class="${lit ? 'a' : 'b'} x sk" stroke-width="1.5" d="${left}"/><path class="${lit ? 'b' : 'a'} x sk" stroke-width="1.5" d="${right}"/><path class="p sk" stroke-width="1.5" d="${top}"/>`;
    }
    const gy = oy + (stair ? 3 : 2) * dy + s + dy;
    c.halftone({
      spacing: 4.5,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      field: [
        { x1: 0, y1: gy + h * 0.12, x2: 0, y2: gy - h * 0.02, amp: 0.85 },
        { x1: lit ? w : 0, y1: 0, x2: lit ? w * 0.4 : w * 0.6, y2: 0 },
      ],
    });
    c.add(out);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(gy)}H${n(w)}"/>`);
    c.add(circle(w * (lit ? 0.14 : 0.86), h * 0.1, w * 0.045, ' class="k"'));
  },

  crescent(c, r, p) {
    const { w, h } = c;
    const dir = pick(p, [1, -1]);
    const bite = 0.32 + p() * 0.2;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.1;
    const cy = h * (0.32 + r() * 0.08);
    const R = w * 0.4;
    const R2 = R * 0.86;
    const d = R * bite;
    const a = (R * R - R2 * R2 + d * d) / (2 * d);
    const hh = Math.sqrt(R * R - a * a);
    const px = cx + dir * a;
    const sweep1 = dir > 0 ? 1 : 0;
    const path = `M${n(px)} ${n(cy + hh)}A${n(R)} ${n(R)} 0 1 ${sweep1} ${n(px)} ${n(cy - hh)}A${n(R2)} ${n(R2)} 0 ${d < a ? 1 : 0} ${1 - sweep1} ${n(px)} ${n(cy + hh)}Z`;
    c.halftone({ spacing: 5, angle: 0.4, maxR: 2.6, cls: 'a', field: { cx, cy, r: w * 0.85, pow: 1.6, amp: 1.1 } });
    c.add(circle(cx, cy, R * 1.14, ' class="sk n" stroke-width="1.2" stroke-dasharray="3 5"'));
    c.add(`<path class="a x sk" stroke-width="3" d="${path}"/>`);
    c.add(circle(cx + dir * R * 0.58, cy - R * 0.1, w * 0.1, ' class="b x"'));
    c.add(circle(cx + dir * R * 0.58, cy - R * 0.1, w * 0.1, ' class="sk n" stroke-width="2.4"'));
    let dots = '';
    for (let i = 0; i < 5; i++) dots += circle(r() * w, r() * h * 0.7, 2 + r() * 2);
    c.add(`<g class="k">${dots}</g>`);
    c.add(`<path class="sk n" stroke-width="1.2" d="M${n(cx)} 0V${n(h)}"/>`);
  },

  dots(c, r, p) {
    const { w, h } = c;
    const cols = pick(p, [5, 7]);
    const vertical = p() < 0.5;
    const g = w / cols;
    const rows = Math.ceil((h * 0.78) / g);
    const fx = r() < 0.5 ? 0 : cols - 1;
    const fy = r() < 0.5 ? 0 : rows - 1;
    const big = Math.floor(r() * cols * rows);
    let all = '';
    let dark = '';
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const t = Math.hypot(i - fx, j - fy) / Math.hypot(cols, rows);
        const rad = g * Math.max(0.08, 0.47 - 0.6 * t);
        if (j * cols + i === big) dark += circle((i + 0.5) * g, (j + 0.5) * g, g * 0.47);
        else all += circle((i + 0.5) * g, (j + 0.5) * g, rad);
      }
    }
    c.add(`<g class="a x">${all}</g><g class="k">${dark}</g>`);
    const band = vertical
      ? { x: w * (0.2 + r() * 0.5), y: -4, w: w * 0.18, h: rows * g + 8 }
      : { x: -4, y: h * (0.15 + r() * 0.3), w: w + 8, h: h * 0.14 };
    c.add(rect(band.x, band.y, band.w, band.h, ' class="b x sk" stroke-width="2.4"'));
    c.halftone({
      spacing: 4.4,
      angle: 0.2,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(`M${n(band.x)} ${n(band.y)}h${n(band.w)}v${n(band.h)}h${n(-band.w)}Z`),
      field: [
        vertical
          ? { x1: 0, y1: fy ? band.h : 0, x2: 0, y2: fy ? 0 : band.h, amp: 0.9 }
          : { x1: fx ? w : 0, y1: 0, x2: fx ? 0 : w, y2: 0, amp: 0.9 },
      ],
    });
  },

  triangles(c, r, p) {
    const { w, h } = c;
    const cols = pick(p, [4, 6]);
    const dense = p() < 0.5;
    const tw = w / cols;
    const th = tw * 0.866;
    const rows = Math.ceil((h * 0.78) / th);
    const fills: Record<string, string> = { 'a x': '', 'b x': '', k: '' };
    for (let j = 0; j < rows; j++) {
      const off = j % 2 ? tw / 2 : 0;
      for (let i = -1; i <= cols; i++) {
        const x = i * tw + off;
        const y = j * th;
        const upTri = `M${n(x)} ${n(y + th)}L${n(x + tw / 2)} ${n(y)}L${n(x + tw)} ${n(y + th)}Z`;
        const downTri = `M${n(x + tw / 2)} ${n(y)}L${n(x + tw * 1.5)} ${n(y)}L${n(x + tw)} ${n(y + th)}Z`;
        for (const tri of [upTri, downTri]) {
          const v = r() / (dense ? 1 : 1.6);
          const cls = v < 0.28 ? 'a x' : v < 0.38 ? 'b x' : v < 0.43 ? 'k' : '';
          if (cls) fills[cls] += tri;
        }
      }
    }
    for (const [cls, d] of Object.entries(fills)) c.add(`<path class="${cls}" d="${d}"/>`);
    const pid = c.id();
    c.defs.push(
      `<pattern id="${pid}" width="${n(tw)}" height="${n(2 * th)}" patternUnits="userSpaceOnUse"><path class="sk n" stroke-width="1.1" d="M0 0H${n(tw)}M0 ${n(th)}H${n(tw)}M0 ${n(th)}L${n(tw / 2)} 0L${n(tw)} ${n(th)}L${n(tw / 2)} ${n(2 * th)}L0 ${n(th)}"/></pattern>`,
    );
    c.add(rect(0, 0, w, rows * th, ` fill="url(#${pid})"`));
    const bi = Math.floor(r() * (cols - 1));
    const bj = 1 + Math.floor(r() * (rows - 3));
    const bx = bi * tw + (bj % 2 ? tw / 2 : 0);
    const by = bj * th;
    c.add(
      `<path class="sk n" stroke-width="3.2" d="M${n(bx)} ${n(by + 2 * th)}L${n(bx + tw)} ${n(by)}L${n(bx + 2 * tw)} ${n(by + 2 * th)}Z"/>`,
    );
    c.add(circle(bx + tw, by + th * 1.3, tw * 0.22, ' class="k"'));
    c.halftone({
      spacing: 5,
      angle: 0.6,
      maxR: 2.1,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.6, x2: 0, y2: h * 0.05, amp: 0.85 },
        { x1: dense ? w : 0, y1: 0, x2: dense ? w * 0.3 : w * 0.7, y2: 0 },
      ],
    });
  },
};
