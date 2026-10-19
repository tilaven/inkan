import { TAU, n, circle, poly, polar, rrect } from './canvas';
import { type MotifFn, pick, rect, circlePath } from './motifs';

const place = (x: number, y: number, deg: number) => `translate(${n(x)} ${n(y)}) rotate(${n(deg)})`;

/** A rounded bar of length `len` and thickness `t` starting at (x, y), turned by `deg`. */
const pill = (x: number, y: number, len: number, t: number, deg: number, attrs = '') =>
  `<path transform="${place(x, y, deg)}"${attrs} d="${rrect(0, -t / 2, len, t, t / 2)}"/>`;

/** Pie wedge between radii `Ri` and `Ro` from angle `a0` to `a1` (clockwise, any span below a full turn). */
const wedge = (cx: number, cy: number, Ri: number, Ro: number, a0: number, a1: number) => {
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, Ro, a0);
  const [x1, y1] = polar(cx, cy, Ro, a1);
  let d = `M${n(x0)} ${n(y0)}A${n(Ro)} ${n(Ro)} 0 ${big} 1 ${n(x1)} ${n(y1)}`;
  if (Ri > 0) {
    const [x2, y2] = polar(cx, cy, Ri, a1);
    const [x3, y3] = polar(cx, cy, Ri, a0);
    d += `L${n(x2)} ${n(y2)}A${n(Ri)} ${n(Ri)} 0 ${big} 0 ${n(x3)} ${n(y3)}`;
  } else d += `L${n(cx)} ${n(cy)}`;
  return d + 'Z';
};

/** Cover motifs for finance, banking, compliance and business-intelligence teams. */
export const FINANCE_MOTIFS: Record<string, MotifFn> = {
  bank(c, r, p) {
    const { w, h } = c;
    const cols = pick(p, [4, 5]);
    const shade = pick(p, [-1, 1]);
    const cx = w * 0.5;
    const L = w * 0.08;
    const R = w * 0.92;
    const top = h * (0.1 + r() * 0.05);
    const ph = h * 0.13;
    const ent = h * 0.055;
    const colTop = top + ph + ent;
    const colBot = h * 0.74;
    const stepH = h * 0.038;
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy: top, r: w * 0.85, pow: 1.6, amp: 1 } });
    const body = `M${n(L)} ${n(top + ph)}H${n(R)}V${n(colBot)}H${n(L)}Z`;
    const pediment = poly([
      [L - w * 0.05, top + ph],
      [cx, top],
      [R + w * 0.05, top + ph],
    ]);
    c.add(`<path class="a x" d="${body}"/>`);
    c.add(`<path class="b x sk" stroke-width="2.8" stroke-linejoin="round" d="${pediment}"/>`);
    c.add(circle(cx, top + ph * 0.64, ph * 0.22, ' class="p sk" stroke-width="2"'));
    c.add(rect(L - w * 0.05, top + ph, R - L + w * 0.1, ent, ' class="k"'));
    const span = R - L;
    const cw = (span / cols) * 0.5;
    let columns = '';
    let flutes = '';
    let caps = '';
    for (let i = 0; i < cols; i++) {
      const x = L + (span * (i + 0.5)) / cols;
      columns += rect(x - cw / 2, colTop, cw, colBot - colTop);
      caps +=
        rect(x - cw * 0.72, colTop, cw * 1.44, h * 0.024) +
        rect(x - cw * 0.72, colBot - h * 0.024, cw * 1.44, h * 0.024);
      flutes += `M${n(x - cw * 0.2)} ${n(colTop + h * 0.03)}V${n(colBot - h * 0.03)}M${n(x + cw * 0.2)} ${n(colTop + h * 0.03)}V${n(colBot - h * 0.03)}`;
    }
    c.add(`<g class="p sk" stroke-width="2.4">${columns}</g>`);
    c.add(`<path class="sk n" stroke-width="1.2" d="${flutes}"/>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      clip: c.clip(body),
      field: [{ x1: cx + shade * w * 0.05, y1: 0, x2: cx - shade * w * 0.55, y2: 0, amp: 0.8 }],
    });
    c.add(`<g class="k">${caps}</g>`);
    for (let i = 0; i < 3; i++) {
      c.add(
        rect(
          L - w * (0.03 + i * 0.045),
          colBot + i * stepH,
          span + w * (0.06 + i * 0.09),
          stepH,
          ' class="p sk" stroke-width="2.4"',
        ),
      );
    }
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
    c.add(
      `<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(colBot + stepH * 3 + h * 0.06)}H${n(w)}"/>`,
    );
  },

  vault(c, r, p) {
    const { w, h } = c;
    const spokes = pick(p, [3, 4]);
    const hinge = pick(p, [-1, 1]);
    const cx = w * 0.5 - hinge * w * 0.04;
    const cy = h * (0.4 + r() * 0.06);
    const R = w * 0.43;
    const disc = circlePath(cx, cy, R);
    const clip = c.clip(disc);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1 } });
    const hx = cx + hinge * R * 0.92;
    c.add(
      `<g class="k">${rect(hx - w * 0.06, cy - R * 0.62, w * 0.12, R * 0.26)}${rect(hx - w * 0.06, cy + R * 0.36, w * 0.12, R * 0.26)}</g>`,
    );
    c.add(`<path class="a x" d="${disc}"/>`);
    c.add(circle(cx, cy, R * 0.78, ' class="sk n" stroke-width="2"'));
    const spin = r() * TAU;
    let bolts = '';
    for (let i = 0; i < 8; i++) {
      const [x, y] = polar(cx, cy, R * 0.89, spin + (i * TAU) / 8);
      bolts += circle(x, y, w * 0.03, ' class="k"') + circle(x, y, w * 0.011, ' class="p"');
    }
    c.add(bolts);
    c.add(circle(cx, cy, R * 0.6, ' class="p sk" stroke-width="2.6"'));
    const turn = r() * TAU;
    let arms = '';
    let knobs = '';
    for (let i = 0; i < spokes; i++) {
      const [x, y] = polar(cx, cy, R * 0.5, turn + (i * TAU) / spokes);
      arms += `M${n(cx)} ${n(cy)}L${n(x)} ${n(y)}`;
      knobs += circle(x, y, w * 0.045, ' class="b x sk" stroke-width="2"');
    }
    c.add(`<path class="sk n" stroke-width="${n(w * 0.05)}" stroke-linecap="round" d="${arms}"/>${knobs}`);
    c.add(circle(cx, cy, w * 0.09, ' class="k"') + circle(cx, cy, w * 0.035, ' class="p"'));
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: { cx: cx - R * 0.6, cy: cy - R * 0.6, r: R * 2, pow: 1.3, amp: 0.9 },
    });
    c.add(`<path class="sk n" stroke-width="3.2" d="${disc}"/>`);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(cy + R * 1.28)}H${n(w)}"/>`);
  },

  calculator(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const round = p() < 0.5;
    const rows = 4;
    const cx = w * 0.5;
    const top = h * (0.05 + r() * 0.04);
    const BW = w * 0.74;
    const BH = h * 0.88;
    const body = rrect(cx - BW / 2, top, BW, BH, w * 0.05);
    const clip = c.clip(body);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'b',
      field: { cx: cx - side * w * 0.3, cy: top + BH * 0.25, r: w * 0.9, pow: 1.6, amp: 1 },
    });
    c.add(`<path class="a x" d="${body}"/>`);
    const dx = cx - BW * 0.42;
    const dy = top + BH * 0.055;
    const dw = BW * 0.84;
    const dh = BH * 0.14;
    c.add(`<path class="p sk" stroke-width="2.4" d="${rrect(dx, dy, dw, dh, w * 0.015)}"/>`);
    const digits = 3 + Math.floor(r() * 3);
    const gw = dw * 0.14;
    let glyphs = '';
    for (let i = 0; i < digits; i++) {
      const x = dx + dw - dw * 0.07 - (i + 1) * gw;
      const seven = r() < 0.5;
      glyphs += rect(x + gw * 0.15, dy + dh * 0.2, gw * 0.7, dh * 0.6, ' class="sk n" stroke-width="2.2"');
      if (!seven)
        glyphs += `<path class="sk n" stroke-width="2.2" d="M${n(x + gw * 0.15)} ${n(dy + dh * 0.5)}h${n(gw * 0.7)}"/>`;
    }
    c.add(glyphs);
    const kx = cx - BW * 0.42;
    const ky = dy + dh + BH * 0.05;
    const kw = BW * 0.84;
    const kh = top + BH - BH * 0.05 - ky;
    const cols = 4;
    const gap = kw * 0.035;
    const cellW = (kw - gap * (cols - 1)) / cols;
    const cellH = (kh - gap * (rows - 1)) / rows;
    const opCol = side > 0 ? cols - 1 : 0;
    let keys = '';
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = kx + i * (cellW + gap);
        const y = ky + j * (cellH + gap);
        const wide = j === rows - 1 && i === (side > 0 ? 0 : 1);
        if (j === rows - 1 && i === (side > 0 ? 1 : 2)) continue;
        const cls = i === opCol ? 'b x sk' : wide ? 'k' : 'p sk';
        keys += rect(
          x,
          y,
          wide ? cellW * 2 + gap : cellW,
          cellH,
          ` rx="${n(round ? cellH * 0.5 : w * 0.012)}" class="${cls}" stroke-width="2"`,
        );
      }
    }
    c.add(keys);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: cx - side * BW * 0.15, y1: 0, x2: cx + side * BW * 0.55, y2: 0, amp: 0.8 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
  },

  percent(c, r, p) {
    const { w, h } = c;
    const coin = p() < 0.5;
    const lean = pick(p, [-1, 1]) * (10 + r() * 10);
    const cx = w * 0.5;
    const cy = h * (0.42 + r() * 0.05);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1 } });
    const at = place(cx, cy, lean);
    const TW = w * 0.88;
    const TH = h * 0.46;
    const tag = poly([
      [-TW / 2, 0],
      [-TW / 2 + TH * 0.35, -TH / 2],
      [TW / 2, -TH / 2],
      [TW / 2, TH / 2],
      [-TW / 2 + TH * 0.35, TH / 2],
    ]);
    const R = w * 0.45;
    const shape = coin ? circlePath(0, 0, R) : tag;
    const S = coin ? R * 1.3 : TH * 0.82;
    const gx = coin ? 0 : TH * 0.2;
    if (!coin) {
      const [sx, sy] = polar(cx, cy, TW / 2 - TH * 0.3, (lean / 360) * TAU + Math.PI);
      c.add(
        `<path class="sk n" stroke-width="2.4" d="M${n(sx)} ${n(sy)}Q${n(sx - w * 0.12)} ${n(sy - h * 0.16)} ${n(sx - w * 0.22)} ${n(-h * 0.02)}"/>`,
      );
    }
    let out = `<path class="a x" d="${shape}"/>`;
    if (coin) out += circle(0, 0, R * 0.86, ' class="sk n" stroke-width="1.8"');
    else out += circle(-TW / 2 + TH * 0.3, 0, TH * 0.08, ' class="p sk" stroke-width="2.4"');
    const ring = (x: number, y: number) =>
      circle(x, y, S * 0.2, ' class="p sk" stroke-width="2.8"') + circle(x, y, S * 0.08, ' class="k"');
    out += ring(gx - S * 0.26, -S * 0.27) + ring(gx + S * 0.26, S * 0.27);
    out += `<path class="sk n" stroke-width="${n(S * 0.13)}" stroke-linecap="round" d="M${n(gx + S * 0.36)} ${n(-S * 0.46)}L${n(gx - S * 0.36)} ${n(S * 0.46)}"/>`;
    out += `<path class="sk n" stroke-width="3" stroke-linejoin="round" d="${shape}"/>`;
    c.add(`<g transform="${at}">${out}</g>`);
    const clipId = c.id();
    c.defs.push(`<clipPath id="${clipId}"><path transform="${at}" d="${shape}"/></clipPath>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: clipId,
      field: { cx: cx - w * 0.3, cy: cy - h * 0.2, r: w * 1.1, pow: 1.3, amp: 0.9 },
    });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.86)}H${n(w)}"/>`);
  },

  passport(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const spine = p() < 0.5;
    const cx = w * 0.5;
    const top = h * (0.07 + r() * 0.04);
    const BW = w * 0.74;
    const BH = h * 0.78;
    const L = cx - BW / 2;
    const body = rrect(L, top, BW, BH, w * 0.035);
    const clip = c.clip(body);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'b',
      field: { cx: cx + side * w * 0.3, cy: top + BH * 0.9, r: w * 0.8, pow: 1.5, amp: 1 },
    });
    c.add(`<path class="a x" d="${body}"/>`);
    if (spine) c.add(`<g clip-path="url(#${clip})">${rect(L, top, w * 0.04, BH, ' class="k"')}</g>`);
    const px = L + BW * 0.12;
    const py = top + BH * 0.09;
    const pw = BW * 0.46;
    const ph = BH * 0.32;
    const photo = `M${n(px)} ${n(py)}h${n(pw)}v${n(ph)}h${n(-pw)}Z`;
    const hx = px + pw / 2;
    const bust = `${circle(hx, py + ph * 0.38, pw * 0.2)}<path d="M${n(px)} ${n(py + ph)}V${n(py + ph * 0.92)}Q${n(px)} ${n(py + ph * 0.6)} ${n(hx)} ${n(py + ph * 0.66)}Q${n(px + pw)} ${n(py + ph * 0.6)} ${n(px + pw)} ${n(py + ph * 0.92)}V${n(py + ph)}Z"/>`;
    c.add(
      `<path class="p sk" stroke-width="2.4" d="${photo}"/><g class="k" clip-path="url(#${c.clip(photo)})">${bust}</g>`,
    );
    c.add(circle(L + BW * 0.8, py + ph * 0.25, w * 0.065, ' class="b x sk" stroke-width="2"'));
    let lines = '';
    for (let i = 0; i < 5; i++) {
      const y = top + BH * (0.5 + i * 0.065);
      const len = BW * (0.3 + r() * 0.45);
      lines += `<path d="${rrect(px, y, len, h * 0.018, h * 0.009)}"/>`;
    }
    c.add(`<g class="k">${lines}</g>`);
    c.add(
      `<path class="sk n" stroke-width="2" stroke-dasharray="3 2" d="M${n(px)} ${n(top + BH * 0.87)}H${n(L + BW * 0.88)}M${n(px)} ${n(top + BH * 0.92)}H${n(L + BW * 0.88)}"/>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: cx - side * BW * 0.1, y1: 0, x2: cx + side * BW * 0.6, y2: 0, amp: 0.8 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${body}"/>`);
    const sx = cx + side * BW * 0.34;
    const sy = top + BH * 0.72;
    const SR = w * 0.17;
    const stamp = `${circle(0, 0, SR, ' class="b x sk" stroke-width="2.8"')}${circle(0, 0, SR * 0.74, ' class="sk n" stroke-width="1.6" stroke-dasharray="3 3"')}<path class="p sk" stroke-width="1.6" d="${rrect(-SR * 0.6, -SR * 0.16, SR * 1.2, SR * 0.32, SR * 0.06)}"/>`;
    c.add(`<g transform="${place(sx, sy, (r() - 0.5) * 40)}">${stamp}</g>`);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(top + BH + h * 0.05)}H${n(w)}"/>`);
  },

  pie(c, r, p) {
    const { w, h } = c;
    const donut = p() < 0.5;
    const slices = pick(p, [4, 5]);
    const cx = w * 0.5;
    const cy = h * (0.38 + r() * 0.05);
    const R = w * 0.44;
    const Ri = donut ? R * 0.4 : 0;
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1 } });
    const weights: number[] = [];
    for (let i = 0; i < slices; i++) weights.push(0.5 + r());
    const total = weights.reduce((s, v) => s + v, 0);
    const pulled = Math.floor(r() * slices);
    const styles = ['a x', 'p', 'k', 'a x', 'p'];
    let a0 = -Math.PI / 2 + r() * TAU;
    let out = '';
    let top = '';
    for (let i = 0; i < slices; i++) {
      const a1 = a0 + (TAU * weights[i]!) / total;
      if (i === pulled) {
        const [ox, oy] = polar(0, 0, R * 0.16, (a0 + a1) / 2);
        top = `<path class="b x sk" stroke-width="2.8" stroke-linejoin="round" d="${wedge(cx + ox, cy + oy, Ri, R, a0, a1)}"/>`;
      } else
        out += `<path class="${styles[i]} sk" stroke-width="2.8" stroke-linejoin="round" d="${wedge(cx, cy, Ri, R, a0, a1)}"/>`;
      a0 = a1;
    }
    c.add(out);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(circlePath(cx, cy, R)),
      field: { cx: cx - R * 0.5, cy: cy - R * 0.6, r: R * 1.9, pow: 1.3, amp: 0.9 },
    });
    c.add(top);
    let legend = '';
    for (let i = 0; i < 3; i++) {
      const y = cy + R + h * (0.075 + i * 0.055);
      legend += rect(w * 0.14, y, w * 0.07, w * 0.07, ` class="${styles[i]} sk" stroke-width="2"`);
      legend += `<path class="k" d="${rrect(w * 0.27, y + w * 0.02, w * (0.25 + r() * 0.3), w * 0.03, w * 0.015)}"/>`;
    }
    c.add(legend);
  },

  handshake(c, r, p) {
    const { w, h } = c;
    const tilt = pick(p, [-8, 8]);
    const flip = p() < 0.5;
    const cx = w * 0.5;
    const cy = h * (0.42 + r() * 0.06);
    const AH = h * (0.15 + r() * 0.02);
    const at = `${flip ? `matrix(-1 0 0 1 ${n(w)} 0) ` : ''}${place(cx, cy, tilt)}`;
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1 } });
    const hand = ' class="p sk" stroke-width="2.6" stroke-linejoin="round"';
    const finger = ' class="p sk" stroke-width="2" stroke-linejoin="round"';
    let out = rect(-w, -AH * 0.4, w * 0.7, AH * 0.8, ' class="a x sk" stroke-width="2.8"');
    out += rect(w * 0.3, -AH * 0.4, w, AH * 0.8, ' class="b x sk" stroke-width="2.8"');
    out +=
      rect(-w * 0.4, -AH * 0.52, w * 0.07, AH * 1.04, hand) + rect(w * 0.31, -AH * 0.52, w * 0.07, AH * 1.04, hand);
    out += `<path${hand} d="${rrect(-w * 0.12, -AH * 0.42, w * 0.46, AH * 0.84, AH * 0.22)}"/>`;
    for (let i = 0; i < 4; i++) out += pill(-w * 0.32 + i * w * 0.065, AH * 0.32, AH * 0.3, w * 0.05, 95, finger);
    for (let i = 0; i < 4; i++) out += pill(-w * 0.02 + i * w * 0.075, -AH * 0.3, AH * 0.82, w * 0.06, 80, finger);
    out += pill(-w * 0.16, -AH * 0.3, w * 0.34, w * 0.065, -22, hand);
    out += `<path${hand} d="${rrect(-w * 0.38, -AH * 0.5, w * 0.42, AH, AH * 0.25)}"/>`;
    c.add(`<g transform="${at}">${out}</g>`);
    const clipId = c.id();
    c.defs.push(
      `<clipPath id="${clipId}"><path transform="${at}" d="${rrect(-w, -AH * 0.6, 2 * w, AH * 1.3, AH * 0.3)}"/></clipPath>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: clipId,
      field: [{ x1: 0, y1: cy - AH * 0.1, x2: 0, y2: cy + AH * 0.75, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(cy + h * 0.26)}H${n(w)}"/>`);
  },
};

/** Words in a project id or name that make a motif the natural pick for that team (lowercase, single words). */
export const FINANCE_KEYWORDS: Record<string, string[]> = {
  bank: ['banking', 'bank', 'neobank', 'deposits', 'branch', 'psd2'],
  vault: ['custody', 'vault', 'wealth', 'savings', 'assets', 'safekeeping'],
  calculator: ['tax', 'accounting', 'fp', 'bookkeeping', 'payroll', 'forecasting'],
  percent: ['lending', 'loans', 'credit', 'mortgage', 'underwriting', 'interest'],
  passport: ['kyc', 'aml', 'kyb', 'sanctions', 'crime', 'verification'],
  pie: ['bi', 'intelligence', 'reporting', 'dashboards', 'kpi', 'okr'],
  handshake: ['partnerships', 'alliances', 'bizdev', 'business', 'solutions', 'presales'],
};
