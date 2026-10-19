import { TAU, n, circle, rrect } from './canvas';
import { type MotifFn, pick, mirrorX, rect, circlePath } from './motifs';

/** Speech bubble: rounded rectangle with a tail on the bottom edge at `tail` (0..1 from the left). */
const bubble = (x: number, y: number, w: number, h: number, rad: number, tail: number, size: number) => {
  const a = (dx: number, dy: number) => `a${n(rad)} ${n(rad)} 0 0 1 ${n(dx)} ${n(dy)}`;
  const tx = x + rad + (w - 2 * rad - size) * tail;
  const dir = tail < 0.5 ? -1 : 1;
  return (
    `M${n(x + rad)} ${n(y)}h${n(w - 2 * rad)}${a(rad, rad)}v${n(h - 2 * rad)}${a(-rad, rad)}` +
    `H${n(tx + size)}L${n(tx + size / 2 + dir * size * 0.9)} ${n(y + h + size * 0.9)}L${n(tx)} ${n(y + h)}` +
    `H${n(x + rad)}${a(-rad, -rad)}v${n(2 * rad - h)}${a(rad, -rad)}Z`
  );
};

const place = (x: number, y: number, deg: number) => `translate(${n(x)} ${n(y)}) rotate(${n(deg)})`;

export const PRODUCT_MOTIFS: Record<string, MotifFn> = {
  browser(c, r, p) {
    const { w, h } = c;
    const left = p() < 0.5;
    const sidebar = p() < 0.5;
    const x0 = left ? -w * 0.14 : w * 0.1;
    const x1 = left ? w * 0.9 : w * 1.14;
    const W = x1 - x0;
    const y0 = h * (0.07 + r() * 0.06);
    const y1 = h * 0.88;
    const bar = h * 0.085;
    const bx = (t: number) => x0 + W * t;
    c.add(rect(x0, y0, W, y1 - y0, ' class="a x"'));
    c.add(rect(x0, y0, W, bar, ' class="k"'));
    let lights = '';
    for (let i = 0; i < 3; i++) lights += circle(bx(left ? 0.17 : 0.07) + i * w * 0.055, y0 + bar / 2, w * 0.02);
    c.add(`<g class="p">${lights}</g>`);
    c.add(
      `<path class="p" d="${rrect(bx(left ? 0.42 : 0.33), y0 + bar * 0.28, W * (left ? 0.5 : 0.56), bar * 0.44, bar * 0.22)}"/>`,
    );
    const top = y0 + bar;
    const heroH = h * (0.2 + r() * 0.08);
    const col = sidebar ? W * 0.3 : 0;
    const sx = left ? bx(0) + col : bx(0);
    c.add(rect(sx + w * 0.04, top + w * 0.04, W - col - w * 0.08, heroH, ' class="b x sk" stroke-width="1.6"'));
    c.add(circle(sx + w * 0.04 + (W - col) * 0.5 - w * 0.04, top + w * 0.04 + heroH * 0.5, w * 0.07, ' class="p"'));
    if (sidebar) {
      const side = left ? bx(0) : bx(1) - col;
      c.add(`<path class="sk n" stroke-width="2" d="M${n(left ? side + col : side)} ${n(top)}V${n(y1)}"/>`);
      let items = '';
      for (let i = 0; i < 6; i++)
        items += rect(side + w * 0.04, top + w * 0.05 + i * h * 0.06, col * (0.3 + r() * 0.5), h * 0.02);
      c.add(`<g class="k">${items}</g>`);
    }
    let lines = '';
    const cols = 2 + Math.floor(r() * 2);
    const cw = (W - col - w * 0.08) / cols;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 7; j++) {
        const ly = top + w * 0.08 + heroH + j * h * 0.045;
        if (ly > y1 - h * 0.03) break;
        lines += rect(sx + w * 0.04 + i * cw, ly, cw * (0.45 + r() * 0.4), h * 0.018);
      }
    }
    c.add(`<g class="k">${lines}</g>`);
    c.add(rect(x0, y0, W, y1 - y0, ' class="sk n" stroke-width="2.8"'));
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.2,
      cls: 'k',
      clip: c.clip(`M${n(x0)} ${n(top)}H${n(x1)}V${n(y1)}H${n(x0)}Z`),
      field: [
        { x1: 0, y1: y1, x2: 0, y2: top + heroH, amp: 0.85 },
        left ? { x1: x1, y1: 0, x2: bx(0.3), y2: 0 } : { x1: x0, y1: 0, x2: bx(0.7), y2: 0 },
      ],
    });
  },

  phone(c, r, p) {
    const { w, h } = c;
    const tilt = pick(p, [-1, 1]) * (5 + p() * 7);
    const W = w * 0.62;
    const H = h * 0.98;
    const bez = w * 0.035;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.1;
    const cy = h * 0.12 + H / 2;
    const rad = w * 0.09;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'a',
      field: {
        cx: cx - tilt * 3,
        cy: h * 0.25,
        r: w * 0.95,
        pow: 1.5,
        amp: 1.05,
      },
    });
    let body = `<path class="k" d="${rrect(-W / 2 - bez, -H / 2 - bez, W + 2 * bez, H + 2 * bez, rad + bez)}"/>`;
    body += `<path class="p" d="${rrect(-W / 2, -H / 2, W, H, rad)}"/><path class="a x" d="${rrect(-W / 2, -H / 2, W, H, rad)}"/>`;
    body += `<path class="k" d="${rrect(-W * 0.2, -H / 2, W * 0.4, h * 0.028, h * 0.014)}"/>`;
    const tile = W / 3.6;
    const gap = (W - 3 * tile) / 4;
    const bi = Math.floor(r() * 2);
    const bj = Math.floor(r() * 3);
    let tiles = '';
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 3; i++) {
        if (i >= bi && i <= bi + 1 && j >= bj && j <= bj + 1) continue;
        tiles += `<path d="${rrect(-W / 2 + gap + i * (tile + gap), -H / 2 + h * 0.07 + j * (tile + gap), tile, tile, tile * 0.28)}"/>`;
      }
    }
    const big = rrect(
      -W / 2 + gap + bi * (tile + gap),
      -H / 2 + h * 0.07 + bj * (tile + gap),
      2 * tile + gap,
      2 * tile + gap,
      tile * 0.3,
    );
    body += `<g class="p sk" stroke-width="1.2">${tiles}<path d="${big}"/></g>`;
    body += `<path class="b x sk" stroke-width="1.6" d="${big}"/>`;
    body += circle(
      -W / 2 + gap + (bi + 1) * (tile + gap),
      -H / 2 + h * 0.07 + (bj + 1) * (tile + gap),
      tile * 0.5,
      ' class="k"',
    );
    body += rect(-W * 0.18, H / 2 - h * 0.035, W * 0.36, h * 0.012, ' class="p"');
    body += `<path class="sk n" stroke-width="2.8" d="${rrect(-W / 2, -H / 2, W, H, rad)}"/>`;
    c.add(`<g transform="${place(cx, cy, tilt)}">${body}</g>`);
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M0 ${n(h * 0.78)}H${n(w)}"/>`);
    c.add(circle(w * (tilt > 0 ? 0.1 : 0.9), h * 0.08, w * 0.04, ' class="k"'));
  },

  neural(c, r, p) {
    const { w, h } = c;
    const layers = pick(p, [
      [3, 4, 3],
      [2, 4, 2],
      [3, 4, 4, 2],
    ]);
    const across = p() < 0.5;
    const R = w * (across ? 0.08 : 0.07);
    const span = across ? w : h * 0.72;
    const depth = across ? h * 0.72 : w;
    const at = (li: number, ni: number): [number, number] => {
      const u =
        (span * (li + 0.5)) / layers.length -
        span * 0.02 +
        (li === 0 || li === layers.length - 1 ? 0 : (r() - 0.5) * span * 0.03);
      const v = (depth * (ni + 0.5)) / layers[li];
      return across ? [u, v + h * 0.04] : [v, u + h * 0.04];
    };
    const nodes = layers.map((count, li) => Array.from({ length: count }, (_, ni) => at(li, ni)));
    const hot = layers.map((count) => Math.floor(r() * count));
    let edges = '';
    let hotEdges = '';
    for (let li = 0; li < layers.length - 1; li++) {
      for (const [ax, ay] of nodes[li]) {
        for (const [bx, by] of nodes[li + 1]) edges += `M${n(ax)} ${n(ay)}L${n(bx)} ${n(by)}`;
      }
      const [ax, ay] = nodes[li][hot[li]];
      const [bx, by] = nodes[li + 1][hot[li + 1]];
      hotEdges += `M${n(ax)} ${n(ay)}L${n(bx)} ${n(by)}`;
    }
    const [hx, hy] = nodes[Math.floor(layers.length / 2)][hot[Math.floor(layers.length / 2)]];
    c.halftone({
      spacing: 5,
      angle: 0.5,
      maxR: 2.4,
      cls: 'a',
      field: { cx: hx, cy: hy, r: w * 0.9, pow: 1.4, amp: 1 },
    });
    c.add(`<path class="sk n" stroke-width="1.8" d="${edges}"/>`);
    c.add(`<path class="sa n x" stroke-width="${n(R * 0.55)}" d="${hotEdges}"/>`);
    let fills = '';
    let hots = '';
    nodes.forEach((layer, li) => {
      const cls = li === 0 || li === layers.length - 1 ? 'b x' : 'a x';
      layer.forEach(([x, y], ni) => {
        if (ni === hot[li]) hots += circle(x, y, R * 1.15);
        else fills += circle(x, y, R, ` class="${cls}"`);
      });
    });
    c.add(`<g class="sk" stroke-width="2.8">${fills}</g><g class="k">${hots}</g>`);
    c.add(`<g class="p">${nodes.map((layer, li) => circle(...layer[hot[li]], R * 0.3)).join('')}</g>`);
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M0 ${n(h * 0.82)}H${n(w)}"/>`);
  },

  card(c, r, p) {
    const { w, h } = c;
    const tilt = pick(p, [-1, 1]) * (9 + p() * 9);
    const chipLeft = p() < 0.5;
    const W = w * 1.02;
    const H = W * 0.63;
    const rad = w * 0.05;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.08;
    const cy = h * (0.4 + r() * 0.08);
    const face = rrect(-W / 2, -H / 2, W, H, rad);
    const lift = -Math.sign(tilt) * W * 0.08;
    c.add(
      `<g transform="${place(cx + lift, cy - H * 0.26, tilt)}"><path class="b x sk" stroke-width="2.4" d="${face}"/>${rect(-W / 2, -H / 2 + H * 0.18, W, H * 0.17, ' class="k"')}</g>`,
    );
    let front = `<path class="a x" d="${face}"/>`;
    const chipX = chipLeft ? -W * 0.38 : W * 0.38 - W * 0.17;
    const chipY = -H * 0.12;
    front += `<path class="p sk" stroke-width="1.6" d="${rrect(chipX, chipY, W * 0.17, H * 0.22, w * 0.015)}"/>`;
    front += `<path class="sk n" stroke-width="1.2" d="M${n(chipX)} ${n(chipY + H * 0.11)}h${n(W * 0.17)}M${n(chipX + W * 0.057)} ${n(chipY)}v${n(H * 0.22)}M${n(chipX + W * 0.113)} ${n(chipY)}v${n(H * 0.22)}"/>`;
    let digits = '';
    for (let g = 0; g < 4; g++) {
      for (let d = 0; d < 4; d++) {
        digits += rect(-W * 0.4 + g * W * 0.21 + d * W * 0.045, H * 0.17, W * 0.032, H * 0.1 + r() * H * 0.03);
      }
    }
    front += `<g class="p">${digits}</g>`;
    front += rect(-W * 0.4, H * 0.34, W * 0.3, H * 0.055, ' class="k"');
    const lx = W * 0.3;
    const ly = H * 0.3;
    front +=
      circle(lx, ly, H * 0.11, ' class="k"') + circle(lx + H * 0.1, ly, H * 0.11, ' class="p x sk" stroke-width="1.4"');
    front += `<path class="sk n" stroke-width="2.6" d="${face}"/>`;
    c.add(`<g transform="${place(cx, cy, tilt)}">${front}</g>`);
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.2,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.85, x2: 0, y2: h * 0.4, amp: 0.85 },
        { x1: tilt > 0 ? w : 0, y1: 0, x2: w * 0.5, y2: 0 },
      ],
    });
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M0 ${n(h * 0.82)}H${n(w)}"/>`);
  },

  cart(c, r, p) {
    const { w, h } = c;
    const X = p() < 0.5 ? (x: number) => w - x : (x: number) => x;
    const wire = p() < 0.5;
    const top = h * (0.26 + r() * 0.05);
    const bottom = h * 0.62;
    const x0 = w * 0.18;
    const x1 = w * 1.02;
    const b0 = x0 + w * 0.09;
    const b1 = x1 - w * 0.14;
    const basket = `M${n(X(x0))} ${n(top)}L${n(X(x1))} ${n(top)}L${n(X(b1))} ${n(bottom)}L${n(X(b0))} ${n(bottom)}Z`;
    const items = 2 + Math.floor(r() * 2);
    let goods = '';
    for (let i = 0; i < items; i++) {
      const gx = x0 + w * 0.1 + i * w * 0.24 + r() * w * 0.06;
      const gw = w * (0.14 + r() * 0.08);
      goods +=
        r() < 0.5
          ? circle(X(gx + gw / 2), top - gw * 0.35, gw * 0.55, ' class="b x sk" stroke-width="1.6"')
          : rect(
              Math.min(X(gx), X(gx + gw)),
              top - h * (0.1 + r() * 0.06),
              gw,
              h * 0.2,
              ' class="b x sk" stroke-width="1.6"',
            );
    }
    c.add(goods);
    c.add(`<path class="a x" d="${basket}"/>`);
    if (wire) {
      let grid = '';
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        grid += `M${n(X(x0 + (x1 - x0) * t))} ${n(top)}L${n(X(b0 + (b1 - b0) * t))} ${n(bottom)}`;
      }
      grid += `M${n(X(x0 + w * 0.045))} ${n((top + bottom) / 2)}L${n(X(x1 - w * 0.07))} ${n((top + bottom) / 2)}`;
      c.add(`<path class="sk n" stroke-width="1.2" d="${grid}"/>`);
    }
    c.halftone({
      spacing: 4.6,
      angle: 0.7,
      maxR: 2,
      cls: 'k',
      clip: c.clip(basket),
      field: [{ x1: X(x1), y1: 0, x2: X(x0 + w * 0.3), y2: 0, amp: 0.85 }],
    });
    c.add(`<path class="sk n" stroke-width="2.6" d="${basket}"/>`);
    const handle = `M${n(X(-w * 0.1))} ${n(top - h * 0.17)}L${n(X(w * 0.06))} ${n(top - h * 0.17)}L${n(X(b0))} ${n(bottom)}L${n(X(b1))} ${n(bottom)}`;
    c.add(`<path class="sk n" stroke-width="${n(w * 0.032)}" stroke-linejoin="round" d="${handle}"/>`);
    const wy = bottom + h * 0.085;
    let wheels = '';
    for (const wx of [x0 + w * 0.2, x1 - w * 0.27]) {
      wheels += circle(X(wx), wy, w * 0.075, ' class="k"') + circle(X(wx), wy, w * 0.028, ' class="p"');
    }
    c.add(wheels);
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(wy + w * 0.09)}H${n(w)}"/>`);
  },

  pen(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const lean = 22 + p() * 16;
    const tx = w * (0.5 + side * (0.08 + r() * 0.1));
    const ty = h * (0.56 + r() * 0.1);
    const L = h * 0.64;
    const W = w * 0.25;
    const nib = `M0 0Q${n(W * 0.25)} ${n(-L * 0.3)} ${n(W)} ${n(-L * 0.62)}L${n(W * 0.78)} ${n(-L)}H${n(-W * 0.78)}L${n(-W)} ${n(-L * 0.62)}Q${n(-W * 0.25)} ${n(-L * 0.3)} 0 0Z`;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.3,
      cls: 'b',
      field: { cx: tx, cy: ty, r: w * 0.7, pow: 1.8, amp: 0.9 },
    });
    const ex = w * (0.5 - side * 0.5) + side * w * 0.04;
    const ey = h * (0.14 + r() * 0.1);
    const c1x = tx - side * w * 0.45;
    const c1y = ty + h * (0.08 + r() * 0.1);
    const c2x = ex + side * w * 0.4;
    const c2y = ey - h * 0.06;
    c.add(
      `<path class="sk n" stroke-width="4" d="M${n(tx)} ${n(ty)}C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(ex)} ${n(ey)}"/>`,
    );
    c.add(
      `<path class="sk n" stroke-width="1.3" d="M${n(tx)} ${n(ty)}L${n(c1x)} ${n(c1y)}M${n(ex)} ${n(ey)}L${n(c2x)} ${n(c2y)}L${n(2 * ex - c2x)} ${n(2 * ey - c2y)}"/>`,
    );
    c.add(
      circle(c1x, c1y, w * 0.03, ' class="k"') +
        circle(c2x, c2y, w * 0.03, ' class="k"') +
        circle(2 * ex - c2x, 2 * ey - c2y, w * 0.03, ' class="k"'),
    );
    c.add(rect(ex - w * 0.035, ey - w * 0.035, w * 0.07, w * 0.07, ' class="p sk" stroke-width="2"'));
    const body = `<path class="a x" d="${nib}"/>${circle(0, -L * 0.5, W * 0.2, ' class="p"')}<path class="sk n" stroke-width="2.6" d="M0 0V${n(-L * 0.5 + W * 0.2)}"/><path class="sk n" stroke-width="3" d="${nib}"/>${rect(-W * 0.78, -L, W * 1.56, L * 0.09, ' class="k"')}`;
    c.add(`<g transform="${place(tx, ty, side * lean)}">${body}</g>`);
    c.add(rect(tx - w * 0.035, ty - w * 0.035, w * 0.07, w * 0.07, ' class="p sk" stroke-width="2"'));
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M0 ${n(h * 0.8)}H${n(w)}"/>`);
  },

  flask(c, r, p) {
    const { w, h } = c;
    const level = pick(p, [0.5, 0.62]);
    const shade = pick(p, [-1, 1]);
    const cx = w * 0.5;
    const top = h * 0.03;
    const base = h * 0.84;
    const neck = w * 0.1;
    const shoulder = h * 0.3;
    const half = w * 0.44;
    const flask = `M${n(cx - neck)} ${n(top)}V${n(shoulder)}L${n(cx - half)} ${n(base - w * 0.06)}Q${n(cx - half - w * 0.02)} ${n(base)} ${n(cx - half + w * 0.05)} ${n(base)}H${n(cx + half - w * 0.05)}Q${n(cx + half + w * 0.02)} ${n(base)} ${n(cx + half)} ${n(base - w * 0.06)}L${n(cx + neck)} ${n(shoulder)}V${n(top)}Z`;
    const clip = c.clip(flask);
    c.add(`<path class="p" d="${flask}"/>`);
    const ly = shoulder + (base - shoulder) * (1 - level);
    const amp = h * 0.015;
    let liquid = `M${n(-w * 0.1)} ${n(ly)}`;
    let sign = r() < 0.5 ? 1 : -1;
    for (let x = -w * 0.1; x < w * 1.1; x += w * 0.2) {
      liquid += `q${n(w * 0.1)} ${n(sign * 2 * amp)} ${n(w * 0.2)} 0`;
      sign = -sign;
    }
    c.add(`<g clip-path="url(#${clip})"><path class="a x" d="${liquid}V${n(h)}H${n(-w * 0.1)}Z"/></g>`);
    let bubbles = '';
    const count = 4 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      const by = ly + r() * (base - ly - w * 0.05);
      const spread = half * (0.2 + (by - shoulder) / (base - shoulder));
      bubbles += circle(cx + (r() - 0.5) * 2 * spread * 0.75, by, w * (0.025 + r() * 0.04));
    }
    c.add(`<g class="b x sk" stroke-width="1.6" clip-path="url(#${clip})">${bubbles}</g>`);
    let vapour = '';
    for (let i = 0; i < 3; i++)
      vapour += circle(
        cx + (r() - 0.5) * w * 0.3,
        top - w * 0.02 - i * w * 0.07 - r() * w * 0.04,
        w * (0.02 + r() * 0.02),
      );
    c.add(`<g class="k">${vapour}</g>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.7,
      maxR: 1.9,
      cls: 'k',
      clip,
      field: [
        {
          x1: shade > 0 ? cx + half : cx - half,
          y1: 0,
          x2: shade > 0 ? cx - half * 0.2 : cx + half * 0.2,
          y2: 0,
          amp: 0.8,
        },
      ],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${flask}"/>`);
    c.add(rect(cx - neck - w * 0.03, top, neck * 2 + w * 0.06, h * 0.03, ' class="k"'));
    c.add(
      `<path class="sk n" stroke-width="1.2" d="M${n(cx + neck + w * 0.03)} ${n(ly)}h${n(w * 0.05)}M${n(cx + half * 0.6)} ${n(ly + (base - ly) * 0.5)}h${n(w * 0.05)}"/>`,
    );
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(base + h * 0.03)}H${n(w)}"/>`);
  },

  globe(c, r, p) {
    const { w, h } = c;
    const tilt = pick(p, [-1, 1]) * (14 + p() * 10);
    const R = w * 0.44;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.08;
    const cy = h * (0.34 + r() * 0.08);
    const disc = circlePath(cx, cy, R);
    const clip = c.clip(disc);
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy, r: w * 0.9, pow: 1.6, amp: 1.1 },
    });
    c.add(`<path class="a x" d="${disc}"/>`);
    const f1 = r() * TAU;
    const f2 = r() * TAU;
    const lx = cx + (r() - 0.5) * R * 0.8;
    const ly = cy + (r() - 0.5) * R * 0.8;
    let land = '';
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * TAU;
      const rr = R * 0.5 * (1 + 0.3 * Math.sin(3 * t + f1) + 0.15 * Math.sin(5 * t + f2));
      land += `${i ? 'L' : 'M'}${n(lx + Math.cos(t) * rr)} ${n(ly + Math.sin(t) * rr)}`;
    }
    c.add(`<g clip-path="url(#${clip})"><path class="b x sk" stroke-width="1.4" d="${land}Z"/></g>`);
    let grid = '';
    for (const k of [0.36, 0.72]) {
      grid += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(R * k)}" ry="${n(R)}"/>`;
      const hh = Math.sqrt(1 - k * k) * R;
      grid += `<path d="M${n(cx - hh)} ${n(cy - R * k)}H${n(cx + hh)}M${n(cx - hh)} ${n(cy + R * k)}H${n(cx + hh)}"/>`;
    }
    grid += `<path d="M${n(cx)} ${n(cy - R)}V${n(cy + R)}"/>`;
    c.add(
      `<g transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})"><g class="sk n" stroke-width="1.2">${grid}</g><path class="sk n" stroke-width="2.6" d="M${n(cx - R)} ${n(cy)}H${n(cx + R)}"/><path class="sk n" stroke-width="1.3" stroke-dasharray="3 4" d="M${n(cx)} ${n(cy - R * 1.3)}V${n(cy + R * 1.3)}"/></g>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: {
        cx: cx - Math.sign(tilt) * R * 0.75,
        cy: cy + R * 0.7,
        r: R * 1.8,
        pow: 1.3,
        amp: 0.95,
      },
    });
    c.add(`<path class="sk n" stroke-width="3.2" d="${disc}"/>`);
    c.add(circle(lx, ly, w * 0.035, ' class="k"'));
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(cy + R * 1.25)}H${n(w)}"/>`);
  },

  bell(c, r, p) {
    const { w, h } = c;
    const badgeSide = pick(p, [-1, 1]);
    const waves = pick(p, [2, 3]);
    const swing = (r() - 0.5) * 16;
    const cx = w * 0.5;
    const top = h * 0.07;
    const B = w * 0.42;
    const S = B * 0.6;
    const lip = h * 0.6;
    const sh = top + (lip - top) * 0.5;
    const body = `M${n(-B)} ${n(lip - top)}Q${n(-S)} ${n(lip - top)} ${n(-S)} ${n(sh - top)}Q${n(-S)} 0 0 0Q${n(S)} 0 ${n(S)} ${n(sh - top)}Q${n(S)} ${n(lip - top)} ${n(B)} ${n(lip - top)}Z`;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy: sh, r: w * 0.95, pow: 1.5, amp: 1.1 },
    });
    let arcs = '';
    for (let i = 1; i <= waves; i++) {
      const rad = B * (0.85 + i * 0.28);
      for (const side of [-1, 1]) {
        const a0 = side > 0 ? -0.35 : Math.PI + 0.35;
        const a1 = side > 0 ? 0.55 : Math.PI - 0.55;
        arcs += `M${n(cx + Math.cos(a0) * rad)} ${n(sh + Math.sin(a0) * rad)}A${n(rad)} ${n(rad)} 0 0 ${side > 0 ? 1 : 0} ${n(cx + Math.cos(a1) * rad)} ${n(sh + Math.sin(a1) * rad)}`;
      }
    }
    c.add(`<path class="sk n" stroke-width="3" stroke-linecap="round" d="${arcs}"/>`);
    let bell = `<path class="a x" d="${body}"/>`;
    bell += `<path class="sk n" stroke-width="1.2" d="M${n(-S * 0.55)} ${n(sh * 0.3 - top * 0.3 + h * 0.02)}Q${n(-S * 0.5)} ${n(lip - top - h * 0.1)} ${n(-B * 0.75)} ${n(lip - top - h * 0.03)}"/>`;
    bell += `<path class="sk n" stroke-width="2.8" d="${body}"/>`;
    bell += `<path class="k" d="${rrect(-B - w * 0.02, lip - top - h * 0.012, 2 * B + w * 0.04, h * 0.045, h * 0.02)}"/>`;
    bell += circle(0, lip - top + h * 0.075, w * 0.07, ' class="k"');
    bell += circle(0, 0, w * 0.045, ' class="k"');
    c.add(`<g transform="${place(cx, top, swing)}">${bell}</g>`);
    c.add(`<path class="sk n" stroke-width="1.4" d="M${n(cx)} 0V${n(top)}"/>`);
    const bx = cx + badgeSide * B * 0.78;
    const by = top + h * 0.1;
    c.add(
      circle(bx, by, w * 0.11, ' class="b x"') +
        circle(bx, by, w * 0.11, ' class="sk n" stroke-width="2.6"') +
        circle(bx, by, w * 0.035, ' class="p"'),
    );
    c.halftone({
      spacing: 4.8,
      angle: 0.6,
      maxR: 2.1,
      cls: 'k',
      field: [
        { x1: 0, y1: lip + h * 0.05, x2: 0, y2: top + h * 0.1, amp: 0.85 },
        { x1: badgeSide > 0 ? 0 : w, y1: 0, x2: w * 0.5, y2: 0 },
      ],
    });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.82)}H${n(w)}"/>`);
  },

  chat(c, r, p) {
    const { w, h } = c;
    const flip = p() < 0.5;
    const rad = w * pick(p, [0.05, 0.11]);
    const y0 = h * (0.08 + r() * 0.05);
    const h1 = h * (0.26 + r() * 0.06);
    const first = bubble(-w * 0.06, y0, w * 0.8, h1, rad, 0.08, w * 0.09);
    const y1 = y0 + h1 + h * 0.07;
    const h2 = h * (0.24 + r() * 0.06);
    const second = bubble(w * 0.26, y1, w * 0.86, h2, rad, 0.92, w * 0.09);
    let out = `<path class="a x" d="${first}"/>`;
    let dots = '';
    for (let i = 0; i < 3; i++) dots += circle(w * 0.2 + i * w * 0.14, y0 + h1 / 2, w * 0.045);
    out += `<g class="p sk" stroke-width="1.6">${dots}</g>`;
    out += `<path class="sk n" stroke-width="2.8" d="${first}"/>`;
    out += `<path class="b x" d="${second}"/>`;
    let lines = '';
    const count = 2 + Math.floor(r() * 2);
    for (let i = 0; i < count; i++) {
      lines += rect(w * 0.34, y1 + h2 * (0.22 + (i * 0.6) / count), w * (0.35 + r() * 0.3), h2 * 0.1, ' rx="3"');
    }
    out += `<g class="k">${lines}</g>`;
    out += `<path class="sk n" stroke-width="2.8" d="${second}"/>`;
    c.add(flip ? mirrorX(w, out) : out);
    c.halftone({
      spacing: 5,
      angle: 0.5,
      maxR: 2.2,
      cls: 'k',
      field: [
        { x1: 0, y1: h * 0.85, x2: 0, y2: y1 - h * 0.05, amp: 0.85 },
        { x1: flip ? 0 : w, y1: 0, x2: w * 0.45, y2: 0 },
      ],
    });
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.82)}H${n(w)}"/>`);
  },
};

/** Words in a project id or name that make a motif the natural pick for that team (lowercase, single words). */
export const PRODUCT_KEYWORDS: Record<string, string[]> = {
  browser: ['frontend', 'web', 'ui', 'webapp', 'website', 'fe'],
  phone: ['mobile', 'ios', 'android', 'app', 'apps', 'native'],
  neural: ['ml', 'ai', 'ds', 'datascience', 'science', 'llm', 'models', 'research', 'machine'],
  card: ['payments', 'billing', 'fintech', 'checkout', 'subscriptions', 'wallet', 'card', 'acquiring', 'issuing'],
  cart: ['commerce', 'ecommerce', 'shop', 'store', 'catalog', 'orders', 'marketplace'],
  pen: ['design', 'ux', 'brand', 'creative', 'illustration', 'visual'],
  flask: ['qa', 'testing', 'test', 'lab', 'labs', 'quality', 'experiments'],
  globe: ['i18n', 'l10n', 'localization', 'international', 'geo', 'maps', 'global'],
  bell: ['notifications', 'notify', 'comms', 'alerts', 'push', 'email', 'deliverability'],
  chat: ['support', 'cx', 'customer', 'success', 'helpdesk', 'community'],
  bars: ['analytics', 'data', 'metrics', 'insights'],
  chevrons: ['growth', 'experimentation', 'acquisition', 'conversion', 'activation'],
  ticker: ['finance', 'trading', 'markets', 'treasury', 'brokerage', 'investing'],
  arcs: ['media', 'content', 'video', 'audio', 'streaming', 'editorial'],
};
