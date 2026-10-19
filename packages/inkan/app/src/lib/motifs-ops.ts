import { TAU, n, circle, poly, polar, rrect } from './canvas';
import { type MotifFn, pick, mirrorX, rect, circlePath } from './motifs';

const place = (x: number, y: number, deg: number) => `translate(${n(x)} ${n(y)}) rotate(${n(deg)})`;

/** Annular sector between radii `Ri` and `Ro`, from angle `a0` to `a1` (clockwise, less than a half turn). */
const sector = (cx: number, cy: number, Ri: number, Ro: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, Ro, a0);
  const [x1, y1] = polar(cx, cy, Ro, a1);
  const [x2, y2] = polar(cx, cy, Ri, a1);
  const [x3, y3] = polar(cx, cy, Ri, a0);
  return `M${n(x0)} ${n(y0)}A${n(Ro)} ${n(Ro)} 0 0 1 ${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}A${n(Ri)} ${n(Ri)} 0 0 0 ${n(x3)} ${n(y3)}Z`;
};

/** A horizontal wave from `x0` to `x1`, `periods` bumps of amplitude `amp`, starting at `y`. */
const wave = (x0: number, x1: number, y: number, periods: number, amp: number, phase: number) => {
  const step = (x1 - x0) / periods;
  let d = `M${n(x0)} ${n(y)}`;
  for (let i = 0; i < periods; i++) {
    const s = (i + phase) % 2 ? -1 : 1;
    d += `q${n(step / 2)} ${n(s * 2 * amp)} ${n(step)} 0`;
  }
  return d;
};

/** A thin wavy ribbon of height `th`, for highlights on water. */
const ribbon = (x0: number, x1: number, y: number, periods: number, amp: number, th: number) => {
  const step = (x1 - x0) / periods;
  let d = `M${n(x0)} ${n(y)}`;
  for (let i = 0; i < periods; i++) d += `q${n(step / 2)} ${n((i % 2 ? -2 : 2) * amp)} ${n(step)} 0`;
  d += `v${n(th)}`;
  for (let i = periods - 1; i >= 0; i--) d += `q${n(-step / 2)} ${n((i % 2 ? -2 : 2) * amp)} ${n(-step)} 0`;
  return d + 'Z';
};

/** Cover motifs for operations, data, hardware and platform-strategy teams. */
export const OPS_MOTIFS: Record<string, MotifFn> = {
  gauge(c, r, p) {
    const { w, h } = c;
    const ticks = pick(p, [9, 13]);
    const hot = pick(p, [-1, 1]);
    const cx = w * 0.5;
    const cy = h * (0.52 + r() * 0.06);
    const R = w * 0.64;
    const dial = `M${n(cx - R)} ${n(cy)}A${n(R)} ${n(R)} 0 0 1 ${n(cx + R)} ${n(cy)}Z`;
    const clip = c.clip(dial);
    c.halftone({
      spacing: 5.2,
      angle: 0.3,
      maxR: 2.4,
      cls: 'b',
      field: { cx, cy: cy + R * 0.4, r: w * 0.6, pow: 1.8, amp: 1 },
    });
    c.add(`<path class="k" d="${rrect(cx - R * 0.6, cy + h * 0.03, R * 1.2, h * 0.07, h * 0.02)}"/>`);
    c.add(`<path class="a x" d="${dial}"/>`);
    const span = 0.55 + r() * 0.2;
    const zone =
      hot > 0
        ? sector(cx, cy, R * 0.7, R * 0.98, -span, -0.04)
        : sector(cx, cy, R * 0.7, R * 0.98, Math.PI + 0.04, Math.PI + span);
    c.add(`<path class="b x sk" stroke-width="1.6" d="${zone}"/>`);
    c.halftone({
      spacing: 4.8,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: cx + hot * R * 0.3, y1: cy, x2: cx - hot * R * 0.9, y2: cy - R * 0.5, amp: 0.8 }],
    });
    let marks = '';
    for (let i = 0; i < ticks; i++) {
      const a = Math.PI + (Math.PI * i) / (ticks - 1);
      const [x0, y0] = polar(cx, cy, R * 0.86, a);
      const [x1, y1] = polar(cx, cy, R * (i % 2 ? 0.8 : 0.72), a);
      marks += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
    }
    c.add(`<path class="sk n" stroke-width="2.6" d="${marks}"/>`);
    c.add(circle(cx, cy, R * 0.86, ' class="sk n" stroke-width="1.2"'));
    const needle = Math.PI + Math.PI * (hot > 0 ? 0.55 + r() * 0.4 : 0.05 + r() * 0.4);
    const [nx, ny] = polar(cx, cy, R * 0.8, needle);
    const [lx, ly] = polar(cx, cy, w * 0.045, needle - Math.PI / 2);
    const [rx, ry] = polar(cx, cy, w * 0.045, needle + Math.PI / 2);
    c.add(
      `<path class="k" d="${poly([
        [lx, ly],
        [nx, ny],
        [rx, ry],
      ])}"/>`,
    );
    c.add(circle(cx, cy, w * 0.09, ' class="k"') + circle(cx, cy, w * 0.03, ' class="p"'));
    c.add(`<path class="sk n" stroke-width="3" d="${dial}"/>`);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(cy + h * 0.16)}H${n(w)}"/>`);
  },

  siren(c, r, p) {
    const { w, h } = c;
    const beams = pick(p, [5, 7]);
    const shade = pick(p, [-1, 1]);
    const cx = w * 0.5;
    const by = h * (0.66 + r() * 0.05);
    const R = w * 0.4;
    const dome = `M${n(cx - R)} ${n(by)}A${n(R)} ${n(R)} 0 0 1 ${n(cx + R)} ${n(by)}Z`;
    const clip = c.clip(dome);
    const fx = cx;
    const fy = by - R * 0.4;
    let rays = '';
    for (let i = 0; i < beams; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / beams;
      const len = R * (1.45 + r() * 0.5);
      const [x0, y0] = polar(fx, fy, R * 1.12, a);
      const [x1, y1] = polar(fx, fy, len, a);
      rays += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
    }
    c.add(`<path class="sk n" stroke-width="${n(w * 0.028)}" stroke-linecap="round" d="${rays}"/>`);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'b',
      field: { cx: fx, cy: fy, r: w * 0.95, pow: 1.6, amp: 1 },
    });
    c.add(`<path class="a x" d="${dome}"/>`);
    let ribs = '';
    for (const t of [-0.6, -0.3, 0.3, 0.6]) ribs += `M${n(cx + R * t)} ${n(by)}V${n(by - R * 1.1)}`;
    c.add(`<g clip-path="url(#${clip})"><path class="sk n" stroke-width="1.2" d="${ribs}"/></g>`);
    c.add(
      `<path class="p sk" stroke-width="2.4" d="${rrect(fx - R * 0.22, fy - R * 0.3, R * 0.44, R * 0.7, R * 0.22)}"/>`,
    );
    c.add(circle(fx, fy - R * 0.02, R * 0.12, ' class="b x"'));
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: cx + shade * R * 0.2, y1: by - R * 0.55, x2: cx - shade * R * 0.3, y2: by + R * 0.05, amp: 0.8 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${dome}"/>`);
    c.add(`<path class="k" d="${rrect(cx - R * 1.12, by - h * 0.012, R * 2.24, h * 0.055, h * 0.02)}"/>`);
    c.add(rect(cx - R * 0.85, by + h * 0.045, R * 1.7, h * 0.06, ' class="a x sk" stroke-width="2.4"'));
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(by + h * 0.15)}H${n(w)}"/>`);
  },

  lifebuoy(c, r, p) {
    const { w, h } = c;
    const turn = pick(p, [0, Math.PI / 4]);
    const rope = p() < 0.5;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.06;
    const cy = h * (0.36 + r() * 0.06);
    const Ro = w * 0.46;
    const Ri = Ro * 0.42;
    const ring = circlePath(cx, cy, Ro) + circlePath(cx, cy, Ri);
    const clipId = c.id();
    c.defs.push(`<clipPath id="${clipId}"><path clip-rule="evenodd" d="${ring}"/></clipPath>`);
    const sea = h * 0.7;
    let water = wave(-w * 0.1, w * 1.1, sea, 6, h * 0.012, Math.floor(r() * 2));
    water += `V${n(h)}H${n(-w * 0.1)}Z`;
    c.add(`<path class="b x" d="${water}"/>`);
    c.add(
      `<path class="sk n" stroke-width="1.4" d="${wave(-w * 0.1, w * 1.1, sea + h * 0.08, 6, h * 0.012, 1)}${wave(-w * 0.1, w * 1.1, sea + h * 0.16, 6, h * 0.012, 0)}"/>`,
    );
    c.add(`<path class="a x" fill-rule="evenodd" d="${ring}"/>`);
    let bands = '';
    for (let i = 0; i < 4; i++) {
      const a = turn + (i * TAU) / 4;
      bands += `<path d="${sector(cx, cy, Ri - 2, Ro + 2, a - 0.42, a + 0.42)}"/>`;
    }
    c.add(`<g class="p sk" stroke-width="2.2" clip-path="url(#${clipId})">${bands}</g>`);
    if (rope) c.add(circle(cx, cy, Ro * 0.86, ' class="sk n" stroke-width="2.2" stroke-dasharray="5 4"'));
    c.halftone({
      spacing: 4.6,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      clip: clipId,
      field: { cx: cx - Ro * 0.5, cy: cy + Ro * 0.6, r: Ro * 1.9, pow: 1.3, amp: 0.9 },
    });
    c.add(
      circle(cx, cy, Ro, ' class="sk n" stroke-width="3.2"') + circle(cx, cy, Ri, ' class="sk n" stroke-width="2.6"'),
    );
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.9)}H${n(w)}"/>`);
  },

  funnel(c, r, p) {
    const { w, h } = c;
    const shade = pick(p, [-1, 1]);
    const bits = pick(p, [4, 6]);
    const cx = w * 0.5;
    const y0 = h * (0.2 + r() * 0.04);
    const y1 = h * 0.56;
    const y2 = h * 0.8;
    const L = w * 0.03;
    const R = w * 0.97;
    const nw = w * 0.085;
    const body = `M${n(L)} ${n(y0)}H${n(R)}L${n(cx + nw)} ${n(y1)}V${n(y2)}H${n(cx - nw)}V${n(y1)}Z`;
    const clip = c.clip(body);
    c.halftone({ spacing: 5, angle: 0.4, maxR: 2.3, cls: 'b', field: { cx, cy: y0, r: w * 0.6, pow: 1.5, amp: 0.9 } });
    let items = '';
    for (let i = 0; i < bits; i++) {
      const x = L + w * 0.1 + r() * (R - L - w * 0.2);
      const y = y0 - h * 0.04 - r() * (y0 - h * 0.06);
      const s = w * (0.035 + r() * 0.035);
      items +=
        r() < 0.5
          ? circle(x, y, s, ' class="k"')
          : rect(x - s, y - s, 2 * s, 2 * s, ' class="b x sk" stroke-width="1.6"');
    }
    c.add(items);
    c.add(`<path class="a x" d="${body}"/>`);
    c.add(
      `<ellipse cx="${n(cx)}" cy="${n(y0)}" rx="${n((R - L) / 2)}" ry="${n(h * 0.03)}" class="b x sk" stroke-width="2.4"/>`,
    );
    c.add(rect(cx - nw * 0.55, y2, nw * 1.1, h - y2, ' class="a x"'));
    c.add(`<path class="sk n" stroke-width="1.4" stroke-dasharray="4 3" d="M${n(cx)} ${n(y2)}V${n(h)}"/>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [
        { x1: cx + shade * w * 0.1, y1: 0, x2: shade > 0 ? R : L, y2: 0, amp: 0.8 },
        { x1: 0, y1: y0 + h * 0.1, x2: 0, y2: y2, amp: 0.5 },
      ],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.9)}H${n(w)}"/>`);
  },

  lake(c, r, p) {
    const { w, h } = c;
    const sunSide = pick(p, [-1, 1]);
    const peaks = pick(p, [1, 2]);
    const hy = h * (0.46 + r() * 0.06);
    const sx = w * (0.5 + sunSide * 0.26);
    const sy = hy - h * (0.2 + r() * 0.06);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.4,
      cls: 'b',
      field: { cx: sx, cy: sy, r: w * 0.45, pow: 1.8, amp: 1 },
    });
    c.add(circle(sx, sy, w * 0.14, ' class="p sk" stroke-width="2.6"'));
    let hills = '';
    let mirror = '';
    for (let i = 0; i < peaks; i++) {
      const px = w * (peaks === 1 ? 0.5 - sunSide * 0.12 : 0.22 + i * 0.5) + (r() - 0.5) * w * 0.1;
      const ph = h * (0.18 + r() * 0.1);
      const hw = w * 0.36;
      hills += poly([
        [px - hw, hy],
        [px, hy - ph],
        [px + hw, hy],
      ]);
      mirror += poly([
        [px - hw, hy],
        [px, hy + ph * 0.7],
        [px + hw, hy],
      ]);
    }
    c.add(`<path class="b x sk" stroke-width="2.8" stroke-linejoin="round" d="${hills}"/>`);
    const water = rect(0, hy, w, h - hy);
    c.add(`<g class="a x">${water}</g>`);
    c.add(
      `<g clip-path="url(#${c.clip(`M0 ${n(hy)}H${n(w)}V${n(h)}H0Z`)})"><path class="k" fill-opacity=".4" d="${mirror}"/></g>`,
    );
    let ripples = '';
    for (let i = 1; i < 8; i++) {
      const y = hy + i * h * 0.065;
      const x0 = r() * w * 0.3;
      ripples += wave(x0, x0 + w * (0.4 + r() * 0.5), y, 3, h * 0.006, i);
    }
    c.add(`<path class="sk n" stroke-width="2" stroke-linecap="round" d="${ripples}"/>`);
    c.halftone({
      spacing: 4.8,
      angle: 0.5,
      maxR: 2.2,
      cls: 'k',
      field: [{ x1: 0, y1: hy, x2: 0, y2: h, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="M0 ${n(hy)}H${n(w)}"/>`);
    c.add(`<path class="p" d="${ribbon(w * 0.1, w * 0.5, hy + h * 0.14, 2, h * 0.008, 4)}"/>`);
  },

  chip(c, r, p) {
    const { w, h } = c;
    const pins = pick(p, [4, 6]);
    const tilt = pick(p, [-6, 6]);
    const S = w * 0.6;
    const cx = w * 0.5;
    const cy = h * (0.42 + r() * 0.06);
    const len = w * 0.13;
    const pw = (S / pins) * 0.45;
    let legs = '';
    let traces = '';
    for (let i = 0; i < pins; i++) {
      const t = -S / 2 + (S * (i + 0.5)) / pins;
      legs += rect(t - pw / 2, -S / 2 - len, pw, len) + rect(t - pw / 2, S / 2, pw, len);
      legs += rect(-S / 2 - len, t - pw / 2, len, pw) + rect(S / 2, t - pw / 2, len, pw);
      if (r() < 0.5) traces += `M${n(t)} ${n(-S / 2 - len)}V${n(-h)}`;
      if (r() < 0.5) traces += `M${n(t)} ${n(S / 2 + len)}V${n(h)}`;
    }
    const body = `<path class="sk n" stroke-width="1.6" d="${traces}"/><g class="k">${legs}</g><path class="a x" d="${rrect(-S / 2, -S / 2, S, S, w * 0.03)}"/>`;
    const die = S * 0.52;
    const inner = `${rect(-die / 2, -die / 2, die, die, ' class="p sk" stroke-width="2.2"')}${rect(-die * 0.3, -die * 0.3, die * 0.6, die * 0.6, ' class="b x sk" stroke-width="1.6"')}`;
    let wires = '';
    for (let i = 0; i < pins; i++) {
      const t = -S / 2 + (S * (i + 0.5)) / pins;
      if (Math.abs(t) > die / 2) continue;
      wires += `M${n(t)} ${n(-S / 2)}V${n(-die / 2)}M${n(t)} ${n(S / 2)}V${n(die / 2)}M${n(-S / 2)} ${n(t)}H${n(-die / 2)}M${n(S / 2)} ${n(t)}H${n(die / 2)}`;
    }
    c.add(
      `<g transform="${place(cx, cy, tilt)}">${body}<path class="sk n" stroke-width="1.2" d="${wires}"/>${inner}${circle(-S * 0.4, -S * 0.4, w * 0.025, ' class="p"')}<path class="sk n" stroke-width="2.8" d="${rrect(-S / 2, -S / 2, S, S, w * 0.03)}"/></g>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.4 + tilt / 60,
      maxR: 2,
      cls: 'k',
      clip: c.clip(`M${n(cx - S * 0.55)} ${n(cy - S * 0.55)}h${n(S * 1.1)}v${n(S * 1.1)}h${n(-S * 1.1)}Z`),
      field: [{ x1: cx - S * 0.2, y1: cy - S * 0.2, x2: cx + S * 0.5, y2: cy + S * 0.5, amp: 0.85 }],
    });
    c.halftone({ spacing: 5.2, angle: 0.7, maxR: 2.2, cls: 'a', field: { cx, cy, r: w * 0.95, pow: 1.6, amp: 0.9 } });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.86)}H${n(w)}"/>`);
  },

  plug(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const prongs = pick(p, [2, 3]);
    const cx = w * 0.5;
    const W = w * 0.56;
    const top = h * (0.4 + r() * 0.06);
    const H = h * 0.26;
    const rad = w * 0.06;
    const plate = rrect(cx - W * 0.6, h * 0.06, W * 1.2, h * 0.2, w * 0.03);
    c.add(`<path class="b x sk" stroke-width="2.6" d="${plate}"/>`);
    const prong = w * 0.065;
    const slot = prongs === 3 ? [-W * 0.26, W * 0.26, 0] : [-W * 0.24, W * 0.24];
    let pins = '';
    slot.forEach((x, i) => {
      const long = i === 2 ? h * 0.07 : 0;
      pins += rect(
        cx + x - prong / 2,
        h * 0.14 - long,
        prong,
        top - h * 0.14 + long + 2,
        ' class="a x sk" stroke-width="2.4"',
      );
      pins += rect(cx + x - prong, h * 0.1 - long, prong * 2, h * 0.025 + long, ' class="k"');
    });
    c.add(pins);
    const body = rrect(cx - W / 2, top, W, H, rad);
    c.add(`<path class="a x" d="${body}"/>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      clip: c.clip(body),
      field: [{ x1: cx - side * W * 0.1, y1: top + H * 0.3, x2: cx + side * W * 0.5, y2: top + H, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
    const cable = `M${n(cx)} ${n(top + H)}C${n(cx)} ${n(h * 1.02)} ${n(cx + side * w * 0.5)} ${n(h * 0.8)} ${n(cx + side * w * 0.75)} ${n(h * 1.1)}`;
    c.add(
      `<path class="sk n" stroke-width="${n(w * 0.075)}" d="${cable}"/><path class="sa n x" stroke-width="${n(w * 0.035)}" d="${cable}"/>`,
    );
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.4,
      cls: 'b',
      field: { cx: cx - side * w * 0.45, cy: h * 0.85, r: w * 0.6, pow: 1.6, amp: 0.9 },
    });
    let bolt = '';
    const bx = cx - side * W * 0.22;
    const by = top + H * 0.5;
    bolt = poly([
      [bx + w * 0.03, by - H * 0.28],
      [bx - w * 0.04, by + H * 0.04],
      [bx + w * 0.01, by + H * 0.04],
      [bx - w * 0.03, by + H * 0.28],
      [bx + w * 0.04, by - H * 0.04],
      [bx, by - H * 0.04],
    ]);
    c.add(`<path class="p sk" stroke-width="1.4" d="${bolt}"/>`);
  },

  hourglass(c, r, p) {
    const { w, h } = c;
    const level = pick(p, [0.3, 0.6]);
    const pillars = p() < 0.5;
    const cx = w * 0.5;
    const top = h * 0.07;
    const bot = h * 0.86;
    const mid = (top + bot) / 2;
    const hw = w * 0.38;
    const nk = w * 0.035;
    const L = cx - hw;
    const R = cx + hw;
    const glass = `M${n(L)} ${n(top)}H${n(R)}Q${n(R)} ${n(mid)} ${n(cx + nk)} ${n(mid)}Q${n(R)} ${n(mid)} ${n(R)} ${n(bot)}H${n(L)}Q${n(L)} ${n(mid)} ${n(cx - nk)} ${n(mid)}Q${n(L)} ${n(mid)} ${n(L)} ${n(top)}Z`;
    const clip = c.clip(glass);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy: mid, r: w * 0.9, pow: 1.5, amp: 1 } });
    c.add(`<path class="p" d="${glass}"/>`);
    const upper = top + (mid - top) * (0.35 + level * 0.5) + (r() - 0.5) * h * 0.04;
    const heap = bot - (bot - mid) * (0.3 + level * 0.6);
    const sand =
      rect(L, upper, 2 * hw, mid - upper) +
      `<path d="M${n(L)} ${n(bot)}V${n(heap + (bot - heap) * 0.5)}Q${n(cx - hw * 0.4)} ${n(heap + (bot - heap) * 0.3)} ${n(cx)} ${n(heap)}Q${n(cx + hw * 0.4)} ${n(heap + (bot - heap) * 0.3)} ${n(R)} ${n(heap + (bot - heap) * 0.5)}V${n(bot)}Z"/>` +
      rect(cx - nk * 0.4, mid, nk * 0.8, heap - mid);
    c.add(`<g class="a x" clip-path="url(#${clip})">${sand}</g>`);
    let grains = '';
    for (let i = 0; i < 5; i++) grains += circle(cx + (r() - 0.5) * w * 0.16, mid + r() * (heap - mid), w * 0.012);
    c.add(`<g class="k">${grains}</g>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: cx - hw * 0.3, y1: 0, x2: R, y2: 0, amp: 0.8 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${glass}"/>`);
    const cap = (y: number) =>
      `<path class="k" d="${rrect(L - w * 0.08, y, 2 * hw + w * 0.16, h * 0.045, h * 0.012)}"/>`;
    c.add(cap(top - h * 0.04) + cap(bot - h * 0.005));
    if (pillars)
      c.add(
        rect(L - w * 0.07, top, w * 0.028, bot - top, ' class="k"') +
          rect(R + w * 0.042, top, w * 0.028, bot - top, ' class="k"'),
      );
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(bot + h * 0.08)}H${n(w)}"/>`);
  },

  flag(c, r, p) {
    const { w, h } = c;
    const flip = p() < 0.5;
    const square = p() < 0.5;
    const px = w * 0.13;
    const y0 = h * (0.08 + r() * 0.05);
    const FW = w * 0.82;
    const FH = h * 0.42;
    const sway = h * (0.03 + r() * 0.03);
    const edge = (y: number, back: boolean, X = (x: number) => x) =>
      back
        ? `C${n(X(px + FW * 0.65))} ${n(y + sway)} ${n(X(px + FW * 0.35))} ${n(y - sway)} ${n(X(px))} ${n(y)}`
        : `C${n(X(px + FW * 0.35))} ${n(y - sway)} ${n(X(px + FW * 0.65))} ${n(y + sway)} ${n(X(px + FW))} ${n(y)}`;
    const band = (a: number, b: number, X = (x: number) => x) =>
      `M${n(X(px))} ${n(a)}${edge(a, false, X)}V${n(b)}${edge(b, true, X)}Z`;
    const cloth = band(y0, y0 + FH);
    const clip = c.clip(cloth);
    let out = `<path class="a x" d="${cloth}"/>`;
    out += `<g clip-path="url(#${clip})"><path class="b x" d="${band(y0 + FH * 0.58, y0 + FH * 0.78)}"/></g>`;
    const ex = px + FW * 0.3;
    const ey = y0 + FH * 0.36;
    out += square
      ? rect(ex - w * 0.09, ey - w * 0.09, w * 0.18, w * 0.18, ' class="p sk" stroke-width="2.2"')
      : circle(ex, ey, w * 0.1, ' class="p sk" stroke-width="2.2"');
    out += `<path class="sk n" stroke-width="1.2" d="M${n(px)} ${n(y0 + FH * 0.2)}${edge(y0 + FH * 0.2, false)}"/>`;
    out += `<path class="sk n" stroke-width="2.8" d="${cloth}"/>`;
    out += rect(px - w * 0.02, 0, w * 0.04, h, ' class="k"') + circle(px, y0 - h * 0.03, w * 0.04, ' class="k"');
    c.add(flip ? mirrorX(w, out) : out);
    c.halftone({
      spacing: 4.8,
      angle: 0.5,
      maxR: 2.2,
      cls: 'k',
      clip: flip ? c.clip(band(y0, y0 + FH, (x) => w - x)) : clip,
      field: [{ x1: flip ? w * 0.55 : w * 0.45, y1: 0, x2: flip ? w * 0.05 : w * 0.95, y2: 0, amp: 0.85 }],
    });
    c.halftone({
      spacing: 5.2,
      angle: 0.3,
      maxR: 2.4,
      cls: 'b',
      field: { cx: flip ? w * 0.4 : w * 0.6, cy: h * 0.9, r: w * 0.75, pow: 1.5, amp: 0.95 },
    });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.86)}H${n(w)}"/>`);
  },

  compass(c, r, p) {
    const { w, h } = c;
    const eight = p() < 0.5;
    const flip = pick(p, [-1, 1]);
    const cx = w * 0.5;
    const cy = h * (0.38 + r() * 0.06);
    const R = w * 0.47;
    const disc = circlePath(cx, cy, R);
    const clip = c.clip(disc);
    c.halftone({ spacing: 5, angle: 0.4, maxR: 2.6, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1.05 } });
    c.add(`<path class="a x" d="${disc}"/>`);
    let ticks = '';
    for (let i = 0; i < 48; i++) {
      const a = (i * TAU) / 48;
      const [x0, y0] = polar(cx, cy, R * 0.98, a);
      const [x1, y1] = polar(cx, cy, R * (i % 12 ? (i % 4 ? 0.92 : 0.87) : 0.8), a);
      ticks += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
    }
    c.add(`<path class="sk n" stroke-width="1.4" d="${ticks}"/>`);
    const star = (Rl: number, Rs: number, count: number, phase: number) => {
      const pts: number[][] = [];
      for (let i = 0; i < count; i++) {
        pts.push(polar(cx, cy, Rl, phase + (i * TAU) / count), polar(cx, cy, Rs, phase + ((i + 0.5) * TAU) / count));
      }
      return poly(pts);
    };
    if (eight) c.add(`<path class="b x sk" stroke-width="1.6" d="${star(R * 0.62, R * 0.12, 4, Math.PI / 4)}"/>`);
    c.add(`<path class="p sk" stroke-width="2.2" d="${star(R * 0.78, R * 0.16, 4, -Math.PI / 2)}"/>`);
    const a = r() * TAU;
    const half = (sign: number, cls: string, attrs = '') =>
      `<path class="${cls}"${attrs} d="${poly([polar(cx, cy, R * 0.68, a + (sign > 0 ? 0 : Math.PI)), polar(cx, cy, R * 0.13, a + Math.PI / 2), polar(cx, cy, R * 0.13, a - Math.PI / 2)])}"/>`;
    c.add(half(flip, 'k') + half(-flip, 'b x sk', ' stroke-width="2"'));
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: { cx: cx - flip * R * 0.7, cy: cy + R * 0.7, r: R * 1.9, pow: 1.3, amp: 0.9 },
    });
    c.add(circle(cx, cy, R * 0.08, ' class="k"') + circle(cx, cy, R * 0.03, ' class="p"'));
    c.add(`<path class="sk n" stroke-width="3.2" d="${disc}"/>`);
    c.add(rect(cx - w * 0.04, cy - R - w * 0.05, w * 0.08, w * 0.08, ' class="k"'));
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(cy + R * 1.22)}H${n(w)}"/>`);
  },

  chain(c, r, p) {
    const { w, h } = c;
    const lean = pick(p, [-1, 1]) * (18 + p() * 10);
    const rings = 3;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.1;
    const cy = h * 0.5;
    const LW = w * 0.36;
    const LH = h * 0.34;
    const t = w * 0.085;
    const step = LH * 0.78;
    const y0 = -((rings - 1) * step) / 2 - LH / 2 + (r() - 0.5) * step * 0.5;
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'a', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1 } });
    let outer = '';
    let bars = '';
    let out = '';
    for (let i = 0; i < rings; i++) {
      const y = y0 + i * step;
      if (i) bars += `<path d="${rrect(-t * 0.7, y - step + LH * 0.58, t * 1.4, step - LH * 0.16, t * 0.7)}"/>`;
      const ring = rrect(-LW / 2, y, LW, LH, LW / 2) + rrect(-LW / 2 + t, y + t, LW - 2 * t, LH - 2 * t, LW / 2 - t);
      outer += ring;
      out += `<path class="${i % 2 ? 'b' : 'a'} x" fill-rule="evenodd" d="${ring}"/><path class="sk n" stroke-width="3" d="${ring}"/>`;
    }
    bars += `<path d="${rrect(-t * 0.7, y0 - step + LH * 0.58, t * 1.4, step - LH * 0.16, t * 0.7)}"/>`;
    bars += `<path d="${rrect(-t * 0.7, y0 + (rings - 1) * step + LH * 0.58, t * 1.4, step - LH * 0.16, t * 0.7)}"/>`;
    c.add(`<g transform="${place(cx, cy, lean)}"><g class="k">${bars}</g>${out}</g>`);
    const clipId = c.id();
    c.defs.push(
      `<clipPath id="${clipId}"><path clip-rule="evenodd" transform="${place(cx, cy, lean)}" d="${outer}"/></clipPath>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: clipId,
      field: [
        { x1: cx - Math.sign(lean) * w * 0.1, y1: h * 0.4, x2: cx + Math.sign(lean) * w * 0.3, y2: h, amp: 0.85 },
      ],
    });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.9)}H${n(w)}"/>`);
  },

  eye(c, r, p) {
    const { w, h } = c;
    const look = pick(p, [-1, 1]);
    const lashes = p() < 0.5;
    const cx = w * 0.5;
    const cy = h * (0.42 + r() * 0.06);
    const EW = w * 0.56;
    const EH = h * (0.1 + r() * 0.03);
    const lid = `M${n(cx - EW)} ${n(cy)}Q${n(cx)} ${n(cy - EH * 2.2)} ${n(cx + EW)} ${n(cy)}`;
    const eye = `${lid}Q${n(cx)} ${n(cy + EH * 2.2)} ${n(cx - EW)} ${n(cy)}Z`;
    const clip = c.clip(eye);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.6, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1.05 } });
    c.add(
      `<path class="sk n" stroke-width="${n(w * 0.05)}" stroke-linecap="round" d="M${n(cx - EW * 0.8)} ${n(cy - EH * 1.7)}Q${n(cx + look * EW * 0.1)} ${n(cy - EH * 2.9)} ${n(cx + EW * 0.8)} ${n(cy - EH * 1.8)}"/>`,
    );
    c.add(`<path class="p" d="${eye}"/>`);
    const ix = cx + look * EW * (0.08 + r() * 0.1);
    const Ri = EH * 1.1;
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const [x0, y0] = polar(ix, cy, Ri * 0.55, (i * TAU) / 12);
      const [x1, y1] = polar(ix, cy, Ri, (i * TAU) / 12);
      rays += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`;
    }
    c.add(
      `<g clip-path="url(#${clip})">${circle(ix, cy, Ri, ' class="a x"')}<path class="sk n" stroke-width="1.2" d="${rays}"/>${circle(ix, cy, Ri * 0.5, ' class="k"')}${circle(ix - Ri * 0.2, cy - Ri * 0.25, Ri * 0.14, ' class="p"')}</g>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: 0, y1: cy + EH * 0.3, x2: 0, y2: cy - EH * 2.2, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${eye}"/><path class="sk n" stroke-width="5" d="${lid}"/>`);
    if (lashes) {
      let lash = '';
      for (const t of [0.15, 0.3, 0.5, 0.7, 0.85]) {
        const x = cx - EW + 2 * EW * t;
        const y = cy - EH * 4.4 * t * (1 - t);
        lash += `M${n(x)} ${n(y)}L${n(x + (t - 0.5) * w * 0.12)} ${n(y - h * 0.045)}`;
      }
      c.add(`<path class="sk n" stroke-width="3" stroke-linecap="round" d="${lash}"/>`);
    }
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.84)}H${n(w)}"/>`);
  },
};

/** Words in a project id or name that make a motif the natural pick for that team (lowercase, single words). */
export const OPS_KEYWORDS: Record<string, string[]> = {
  gauge: ['performance', 'perf', 'latency', 'capacity', 'speed', 'scaling'],
  siren: ['incident', 'incidents', 'response', 'escalation', 'outage', 'emergency'],
  lifebuoy: ['dr', 'backup', 'recovery', 'resilience', 'continuity', 'bcp'],
  funnel: ['etl', 'ingestion', 'dataeng', 'elt', 'transform', 'dataops'],
  lake: ['lakehouse', 'warehouse', 'lake', 'dwh', 'datalake', 'snowflake'],
  chip: ['firmware', 'embedded', 'iot', 'devices', 'sensors', 'robotics'],
  plug: ['api', 'apis', 'gateway', 'integrations', 'connectors', 'partners'],
  hourglass: ['scheduling', 'batch', 'cron', 'jobs', 'workflow', 'workflows'],
  flag: ['flags', 'feature', 'toggles', 'rollout', 'launch', 'launches'],
  compass: ['architecture', 'arch', 'strategy', 'radar', 'principles', 'guild'],
  chain: ['blockchain', 'crypto', 'web3', 'ledger', 'tokens', 'defi'],
  eye: ['fraud', 'abuse', 'moderation', 'safety', 'integrity', 'risk'],
};
