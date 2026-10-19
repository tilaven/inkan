import { TAU, n, circle, poly, polar, rrect, type Point } from './canvas';
import { type MotifFn, pick, mirrorX, rect, circlePath } from './motifs';

const place = (x: number, y: number, deg: number) => `translate(${n(x)} ${n(y)}) rotate(${n(deg)})`;

const pt = ([x, y]: Point) => `${n(x)} ${n(y)}`;

const baseline = (w: number, y: number) =>
  `<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(y)}H${n(w)}"/>`;

/** Regular hexagon, flat side up. */
const hexagon = (cx: number, cy: number, R: number) => {
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) pts.push(polar(cx, cy, R, (i * TAU) / 6));
  return poly(pts);
};

/**
 * One edge of a puzzle piece from `a` to `b`: a straight run with a knob in the middle, bulging outwards
 * (`s` = 1) or inwards (`s` = -1) relative to a clockwise walk around the piece; `s` = 0 is a flat edge.
 */
const knobEdge = (a: Point, b: Point, s: number) => {
  if (!s) return `L${pt(b)}`;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const P = (t: number, k: number): Point => [a[0] + ux * len * t + uy * k * s, a[1] + uy * len * t - ux * k * s];
  const neck = len * 0.07;
  const head = len * 0.17;
  const dome = head * 1.33;
  return (
    `L${pt(P(0.5 - neck / len, 0))}` +
    `C${pt(P(0.5 - neck / len, neck * 1.4))} ${pt(P(0.5 - head / len, neck * 1.4))} ${pt(P(0.5 - head / len, neck * 2.2))}` +
    `C${pt(P(0.5 - head / len, neck * 2.2 + dome))} ${pt(P(0.5 + head / len, neck * 2.2 + dome))} ${pt(P(0.5 + head / len, neck * 2.2))}` +
    `C${pt(P(0.5 + head / len, neck * 1.4))} ${pt(P(0.5 + neck / len, neck * 1.4))} ${pt(P(0.5 + neck / len, 0))}` +
    `L${pt(b)}`
  );
};

/** A curly brace opening to the right, `H` tall, `d` deep, centred on (x, cy); mirror for the closing one. */
const brace = (x: number, cy: number, H: number, d: number) => {
  const top = cy - H / 2;
  const bot = cy + H / 2;
  return (
    `M${n(x + d)} ${n(top)}q${n(-d)} 0 ${n(-d)} ${n(d)}V${n(cy - d)}q0 ${n(d)} ${n(-d)} ${n(d)}` +
    `q${n(d)} 0 ${n(d)} ${n(d)}V${n(bot - d)}q0 ${n(d)} ${n(d)} ${n(d)}`
  );
};

/** Cover motifs for engineering, product, developer-relations and other work-of-the-company teams. */
export const WORK_MOTIFS: Record<string, MotifFn> = {
  wrench(c, r, p) {
    const { w, h } = c;
    const lean = pick(p, [-1, 1]) * (24 + p() * 10);
    const crossed = p() < 0.5;
    const cx = w * 0.5 + (r() - 0.5) * w * 0.06;
    const cy = h * 0.5;
    const L = h * 0.82;
    const R = w * 0.2;
    const t = w * 0.13;
    const jaw = R * 0.42;
    const jy = -Math.sqrt(R * R - jaw * jaw);
    const head =
      `M${n(-jaw)} ${n(-L / 2 + R + jy)}A${n(R)} ${n(R)} 0 1 0 ${n(jaw)} ${n(-L / 2 + R + jy)}` +
      `L${n(jaw)} ${n(-L / 2 + R * 0.55)}H${n(-jaw)}Z`;
    const ring = circlePath(0, L / 2 - R, R) + hexagon(0, L / 2 - R, R * 0.48);
    const shaft = rrect(-t / 2, -L / 2 + R * 0.6, t, L - R * 1.2, t * 0.2);
    const body = `${head}${shaft}${ring}`;
    const clipId = c.id();
    c.defs.push(
      `<clipPath id="${clipId}"><path clip-rule="evenodd" transform="${place(cx, cy, lean)}" d="${body}"/></clipPath>`,
    );
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1 } });
    if (crossed) {
      const hw = w * 0.11;
      const driver =
        `<path class="b x sk" stroke-width="2.6" d="${rrect(-hw / 2, -L / 2 + h * 0.04, hw, L * 0.42, hw * 0.4)}"/>` +
        rect(-hw * 0.22, -L / 2 + L * 0.42, hw * 0.44, L * 0.52, ' class="k"') +
        `<path class="k" d="${poly([
          [-hw * 0.45, L / 2 - L * 0.06],
          [hw * 0.45, L / 2 - L * 0.06],
          [hw * 0.2, L / 2 + h * 0.03],
          [-hw * 0.2, L / 2 + h * 0.03],
        ])}"/>`;
      c.add(`<g transform="${place(cx, cy, -lean)}">${driver}</g>`);
    }
    c.add(
      `<g transform="${place(cx, cy, lean)}"><path class="a x" fill-rule="evenodd" d="${body}"/>` +
        `<path class="sk n" stroke-width="1.4" d="M${n(-t * 0.18)} ${n(-L / 2 + R * 0.9)}V${n(L / 2 - R * 1.6)}"/>` +
        `<path class="sk n" stroke-width="3" d="${body}"/></g>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: clipId,
      field: [{ x1: cx - Math.sign(lean) * w * 0.05, y1: 0, x2: cx + Math.sign(lean) * w * 0.3, y2: 0, amp: 0.85 }],
    });
    const nx = cx - Math.sign(lean) * w * 0.33;
    const ny = cy + h * (0.24 + r() * 0.08);
    c.add(
      `<path class="p sk" stroke-width="2.4" fill-rule="evenodd" d="${hexagon(nx, ny, w * 0.1)}${circlePath(nx, ny, w * 0.045)}"/>`,
    );
    c.add(baseline(w, h * 0.92));
  },

  puzzle(c, r, p) {
    const { w, h } = c;
    const cols = 2;
    const rows = 3;
    const lifted = pick(p, [0, 1, 4, 5]);
    const cw = w / cols;
    const ch = h / rows;
    const hor: number[] = [];
    const ver: number[] = [];
    for (let i = 0; i < cols * (rows - 1); i++) hor.push(r() < 0.5 ? 1 : -1);
    for (let i = 0; i < (cols - 1) * rows; i++) ver.push(r() < 0.5 ? 1 : -1);
    const piece = (i: number, j: number) => {
      const x = i * cw;
      const y = j * ch;
      const top = j ? -hor[(j - 1) * cols + i]! : 0;
      const bottom = j < rows - 1 ? hor[j * cols + i]! : 0;
      const left = i ? -ver[j * (cols - 1) + i - 1]! : 0;
      const right = i < cols - 1 ? ver[j * (cols - 1) + i]! : 0;
      return (
        `M${n(x)} ${n(y)}` +
        knobEdge([x, y], [x + cw, y], top) +
        knobEdge([x + cw, y], [x + cw, y + ch], right) +
        knobEdge([x + cw, y + ch], [x, y + ch], bottom) +
        knobEdge([x, y + ch], [x, y], left) +
        'Z'
      );
    };
    const inks = ['a x', 'b x', 'p', 'b x', 'p', 'a x'];
    let flat = '';
    let out = '';
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const d = piece(i, j);
        if (k === lifted) {
          const dx = (i ? 1 : -1) * w * (0.05 + r() * 0.04);
          const dy = (j === rows - 1 ? 1 : -1) * h * 0.03;
          const tilt = (i ? 1 : -1) * (5 + r() * 6);
          const cx = (i + 0.5) * cw;
          const cy = (j + 0.5) * ch;
          out += `<path class="${inks[k]} sk" stroke-width="3" transform="translate(${n(dx)} ${n(dy)}) rotate(${n(tilt)} ${n(cx)} ${n(cy)})" d="${d}"/>`;
        } else {
          flat += `<path class="${inks[k]} sk" stroke-width="3" d="${d}"/>`;
        }
      }
    }
    c.add(flat);
    c.halftone({
      spacing: 4.8,
      angle: 0.5,
      maxR: 2.1,
      cls: 'k',
      field: [{ x1: 0, y1: h * 0.45, x2: 0, y2: h * 1.1, amp: 0.55 }],
    });
    c.add(out);
  },

  brackets(c, r, p) {
    const { w, h } = c;
    const cursor = p() < 0.5;
    const tilt = pick(p, [-1, 1]) * (3 + p() * 4);
    const cx = w * 0.5;
    const cy = h * (0.46 + r() * 0.05);
    const H = h * 0.66;
    const d = w * 0.1;
    const gap = w * 0.24;
    const open = brace(cx - gap, cy, H, d);
    const close = mirrorX(w, `<path d="${brace(w - cx - gap, cy, H, d)}"/>`);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.5, cls: 'b', field: { cx, cy, r: w * 0.9, pow: 1.5, amp: 1 } });
    const pair = (cls: string, width: number) =>
      `<g class="${cls}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"><path d="${open}"/>${close}</g>`;
    let inner = '';
    if (cursor) {
      inner += rect(cx - w * 0.05, cy - H * 0.14, w * 0.1, H * 0.28, ' class="k"');
      inner += `<path class="sk n" stroke-width="2.4" d="M${n(cx - w * 0.12)} ${n(cy + H * 0.22)}H${n(cx + w * 0.12)}"/>`;
    } else {
      for (const t of [-1, 0, 1]) inner += circle(cx + t * w * 0.12, cy + H * 0.02, w * 0.045, ' class="k"');
    }
    c.add(
      `<g transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})">${pair('sk n', w * 0.11)}${pair('sa n x', w * 0.06)}${inner}</g>`,
    );
    const lines = 2 + Math.floor(r() * 2);
    let code = '';
    for (let i = 0; i < lines; i++) {
      const y = h * (0.06 + i * 0.045);
      code += rect(w * 0.06, y, w * (0.16 + r() * 0.3), h * 0.022, i % 2 ? ' class="b x"' : ' class="k"');
    }
    for (let i = 0; i < lines; i++) {
      const y = h * (0.94 - i * 0.045);
      const len = w * (0.16 + r() * 0.3);
      code += rect(w * 0.94 - len, y - h * 0.022, len, h * 0.022, i % 2 ? ' class="b x"' : ' class="k"');
    }
    c.add(code);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      field: [{ x1: 0, y1: cy + H * 0.1, x2: 0, y2: h, amp: 0.6 }],
    });
  },

  headset(c, r, p) {
    const { w, h } = c;
    const square = p() < 0.5;
    const strap = pick(p, [1, 2]);
    const tilt = (r() - 0.5) * 8;
    const cx = w * 0.5;
    const cy = h * (0.36 + r() * 0.05);
    const W = w * 0.88;
    const H = h * 0.27;
    const rad = w * 0.09;
    const nose = w * 0.11;
    const L = cx - W / 2;
    const R = cx + W / 2;
    const top = cy - H / 2;
    const bot = cy + H / 2;
    const arc = (dx: number, dy: number) => `a${n(rad)} ${n(rad)} 0 0 1 ${n(dx)} ${n(dy)}`;
    const shell =
      `M${n(L + rad)} ${n(top)}H${n(R - rad)}${arc(rad, rad)}V${n(bot - rad)}${arc(-rad, rad)}` +
      `H${n(cx + nose)}A${n(nose)} ${n(nose)} 0 0 0 ${n(cx - nose)} ${n(bot)}H${n(L + rad)}${arc(-rad, -rad)}V${n(top + rad)}${arc(rad, -rad)}Z`;
    const beam = poly([
      [cx - W * 0.3, bot],
      [cx + W * 0.3, bot],
      [w * 1.1, h * 1.1],
      [-w * 0.1, h * 1.1],
    ]);
    c.add(`<path class="b x" d="${beam}"/>`);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'a',
      clip: c.clip(beam),
      field: [{ x1: 0, y1: bot, x2: 0, y2: h * 1.1, amp: 1 }],
    });
    let bands = rect(-w * 0.1, cy - H * 0.22, w * 1.2, H * 0.44, ' class="k"');
    if (strap === 2) bands += rect(cx - w * 0.07, -h * 0.05, w * 0.14, cy - h * 0.05, ' class="k"');
    c.add(`<g transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})">${bands}</g>`);
    const clip = c.clip(shell);
    let lenses = '';
    for (const s of [-1, 1]) {
      const lx = cx + s * W * 0.24;
      const ly = cy - H * 0.04;
      const lr = Math.min(H * 0.3, W * 0.14);
      lenses += square
        ? `<path class="p sk" stroke-width="2.4" d="${rrect(lx - lr * 1.15, ly - lr, lr * 2.3, lr * 2, lr * 0.4)}"/>`
        : circle(lx, ly, lr * 1.1, ' class="p sk" stroke-width="2.4"');
      lenses +=
        circle(lx, ly, lr * 0.55, ' class="b x"') + circle(lx - lr * 0.25, ly - lr * 0.3, lr * 0.18, ' class="p"');
    }
    c.add(
      `<g transform="rotate(${n(tilt)} ${n(cx)} ${n(cy)})"><path class="a x" d="${shell}"/>${lenses}<path class="sk n" stroke-width="1.4" d="M${n(L + rad)} ${n(top + H * 0.18)}H${n(R - rad)}"/><path class="sk n" stroke-width="3.2" stroke-linejoin="round" d="${shell}"/></g>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip,
      field: [{ x1: cx, y1: top + H * 0.3, x2: cx, y2: bot, amp: 0.75 }],
    });
    c.add(baseline(w, h * 0.9));
  },

  clipboard(c, r, p) {
    const { w, h } = c;
    const tilt = pick(p, [-1, 1]) * (3 + p() * 3);
    const round = p() < 0.5;
    const rows = 3 + Math.floor(r() * 2);
    const cx = w * 0.5;
    const W = w * 0.78;
    const top = h * 0.1;
    const board = rrect(cx - W / 2, top, W, h * 1.1 - top, w * 0.05);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'b',
      field: { cx, cy: h * 0.55, r: w * 0.9, pow: 1.4, amp: 1 },
    });
    const sheet = rect(cx - W * 0.42, top + h * 0.07, W * 0.84, h * 1.1, ' class="p sk" stroke-width="2.4"');
    let list = '';
    for (let i = 0; i < rows; i++) {
      const y = top + h * (0.18 + i * 0.15);
      const bx = cx - W * 0.33;
      const s = w * 0.07;
      const done = r() < 0.6;
      list += round
        ? circle(bx + s / 2, y + s / 2, s / 2, ' class="sk n" stroke-width="2.4"')
        : rect(bx, y, s, s, ' class="sk n" stroke-width="2.4"');
      if (done)
        list += `<path class="sk n" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M${n(bx + s * 0.15)} ${n(y + s * 0.5)}L${n(bx + s * 0.45)} ${n(y + s * 0.85)}L${n(bx + s * 1.15)} ${n(y - s * 0.15)}"/>`;
      list += rect(bx + s * 1.6, y + s * 0.2, W * (0.22 + r() * 0.22), s * 0.6, done ? ' class="b x"' : ' class="k"');
    }
    const clipW = w * 0.3;
    const clipTop = top - h * 0.045;
    const clamp =
      `<path class="k" d="${rrect(cx - clipW / 2, clipTop, clipW, h * 0.12, w * 0.03)}"/>` +
      `<path class="p sk" stroke-width="2" d="${rrect(cx - clipW * 0.28, clipTop - h * 0.035, clipW * 0.56, h * 0.07, w * 0.04)}"/>`;
    c.add(
      `<g transform="rotate(${n(tilt)} ${n(cx)} ${n(h * 0.6)})"><path class="a x" d="${board}"/><path class="sk n" stroke-width="3" d="${board}"/>${sheet}${list}${clamp}</g>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(board),
      field: [{ x1: cx, y1: h * 0.4, x2: cx + Math.sign(tilt) * W * 0.6, y2: h, amp: 0.7 }],
    });
  },

  cap(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const scroll = p() < 0.5;
    const cx = w * 0.5;
    const cy = h * (0.36 + r() * 0.05);
    const RW = w * 0.5;
    const RH = h * 0.13;
    const board = poly([
      [cx - RW, cy],
      [cx, cy - RH],
      [cx + RW, cy],
      [cx, cy + RH],
    ]);
    const skull =
      `M${n(cx - RW * 0.62)} ${n(cy + RH * 0.3)}V${n(cy + RH * 0.3 + h * 0.12)}` +
      `Q${n(cx)} ${n(cy + RH * 0.3 + h * 0.24)} ${n(cx + RW * 0.62)} ${n(cy + RH * 0.3 + h * 0.12)}V${n(cy + RH * 0.3)}Z`;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.5,
      cls: 'b',
      field: { cx, cy: cy + h * 0.1, r: w * 0.95, pow: 1.4, amp: 1 },
    });
    c.add(`<path class="b x sk" stroke-width="3" d="${skull}"/>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(skull),
      field: [{ x1: cx - side * RW * 0.3, y1: 0, x2: cx + side * RW * 0.5, y2: 0, amp: 0.8 }],
    });
    c.add(`<path class="a x" d="${board}"/>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      clip: c.clip(board),
      field: [{ x1: cx, y1: cy - RH * 0.4, x2: cx + side * RW * 0.9, y2: cy + RH * 0.8, amp: 0.8 }],
    });
    c.add(`<path class="sk n" stroke-width="3" stroke-linejoin="round" d="${board}"/>`);
    c.add(circle(cx, cy, w * 0.03, ' class="k"'));
    const ex = cx + side * RW * 0.95;
    const ty = cy + h * (0.3 + r() * 0.06);
    const cord = `M${n(cx)} ${n(cy)}Q${n(ex)} ${n(cy + h * 0.02)} ${n(ex)} ${n(ty)}`;
    c.add(`<path class="sk n" stroke-width="3" stroke-linecap="round" d="${cord}"/>`);
    c.add(circle(ex, ty, w * 0.035, ' class="k"'));
    c.add(
      `<path class="a x sk" stroke-width="2.4" d="${poly([
        [ex - w * 0.04, ty],
        [ex + w * 0.04, ty],
        [ex + w * 0.06, ty + h * 0.1],
        [ex - w * 0.06, ty + h * 0.1],
      ])}"/>`,
    );
    if (scroll) {
      const sy = h * 0.8;
      const sw = w * 0.5;
      c.add(`<path class="p sk" stroke-width="2.4" d="${rrect(cx - sw / 2, sy, sw, h * 0.08, h * 0.04)}"/>`);
      c.add(rect(cx - w * 0.04, sy - h * 0.01, w * 0.08, h * 0.1, ' class="b x sk" stroke-width="2.4"'));
    }
    c.add(baseline(w, h * 0.93));
  },

  laptop(c, r, p) {
    const { w, h } = c;
    const dark = p() < 0.5;
    const splay = pick(p, [0.06, 0.1]);
    const cx = w * 0.5;
    const W = w * 0.8;
    const top = h * (0.15 + r() * 0.04);
    const H = h * 0.42;
    const rad = w * 0.03;
    const lid = rrect(cx - W / 2, top, W, H, rad);
    const screen = rrect(cx - W * 0.44, top + h * 0.02, W * 0.88, H - h * 0.04, rad * 0.5);
    const base = poly([
      [cx - W / 2, top + H],
      [cx + W / 2, top + H],
      [cx + W / 2 + w * splay, top + H + h * 0.1],
      [cx - W / 2 - w * splay, top + H + h * 0.1],
    ]);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'b',
      field: { cx, cy: top + H * 0.5, r: w * 0.95, pow: 1.4, amp: 1 },
    });
    c.add(`<path class="k" d="${lid}"/>`);
    c.add(`<path class="${dark ? 'a x' : 'p'}" d="${screen}"/>`);
    let content = '';
    const lines = 4 + Math.floor(r() * 3);
    for (let i = 0; i < lines; i++) {
      const y = top + h * (0.06 + i * 0.05);
      const indent = r() < 0.4 ? W * 0.08 : 0;
      content += rect(
        cx - W * 0.36 + indent,
        y,
        W * (0.15 + r() * 0.4),
        h * 0.022,
        i % 3 === 1 ? ' class="b x"' : dark ? ' class="p"' : ' class="k"',
      );
    }
    content += circle(cx + W * 0.3, top + H * 0.3, W * 0.1, ' class="b x"');
    c.add(`<g clip-path="url(#${c.clip(screen)})">${content}</g>`);
    c.add(`<path class="sk n" stroke-width="2.6" d="${lid}${screen}"/>`);
    c.add(`<path class="a x sk" stroke-width="3" stroke-linejoin="round" d="${base}"/>`);
    let keys = '';
    const ky = top + H + h * 0.02;
    for (let j = 0; j < 3; j++) {
      const y = ky + h * 0.008 + j * h * 0.025;
      keys += `M${n(cx - W * 0.42 + j * W * 0.02)} ${n(y)}H${n(cx + W * 0.42 - j * W * 0.02)}`;
    }
    c.add(
      `<path class="sk n" stroke-width="${n(h * 0.016)}" stroke-dasharray="${n(W * 0.07)} ${n(W * 0.03)}" d="${keys}"/>`,
    );
    c.add(
      `<path class="p sk" stroke-width="1.6" d="${rrect(cx - W * 0.12, ky + h * 0.078, W * 0.24, h * 0.016, h * 0.004)}"/>`,
    );
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(base),
      field: [{ x1: 0, y1: top + H, x2: 0, y2: top + H + h * 0.1, amp: 0.7 }],
    });
    c.add(`<path class="k" d="${rrect(cx - W * 0.6, top + H + h * 0.1, W * 1.2, h * 0.03, h * 0.015)}"/>`);
    c.add(baseline(w, top + H + h * 0.22));
  },

  target(c, r, p) {
    const { w, h } = c;
    const side = pick(p, [-1, 1]);
    const bands = pick(p, [3, 4]);
    const cx = w * 0.5 + (r() - 0.5) * w * 0.04;
    const cy = h * (0.38 + r() * 0.05);
    const R = w * 0.47;
    const disc = circlePath(cx, cy, R);
    c.halftone({ spacing: 5, angle: 0.3, maxR: 2.6, cls: 'b', field: { cx, cy, r: w * 1.05, pow: 1.4, amp: 1.05 } });
    let rings = '';
    for (let i = 0; i < bands; i++) {
      const rr = R * (1 - i / bands);
      rings += circle(cx, cy, rr, i % 2 ? ' class="p"' : ' class="a x"');
    }
    rings += circle(cx, cy, R * 0.12, ' class="b x"');
    c.add(rings);
    c.halftone({
      spacing: 4.6,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(disc),
      field: { cx: cx - side * R * 0.5, cy: cy + R * 0.6, r: R * 2, pow: 1.3, amp: 0.85 },
    });
    let edges = '';
    for (let i = 0; i < bands; i++) edges += circle(cx, cy, R * (1 - i / bands));
    c.add(`<g class="sk n" stroke-width="2.8">${edges}</g>`);
    const a = (side > 0 ? 0.35 : 0.65) * Math.PI + (r() - 0.5) * 0.3;
    const tipR = R * 0.05;
    const [x0, y0] = polar(cx, cy, tipR, a);
    const [x1, y1] = polar(cx, cy, R * 2.4, a);
    const t = w * 0.045;
    c.add(
      `<path class="sk n" stroke-width="${n(t * 1.9)}" stroke-linecap="round" d="M${pt([x0, y0])}L${pt([x1, y1])}"/>`,
    );
    c.add(
      `<path class="sa n x" stroke-width="${n(t * 0.9)}" stroke-linecap="round" d="M${pt([x0, y0])}L${pt([x1, y1])}"/>`,
    );
    const headLen = w * 0.16;
    const [hx, hy] = polar(cx, cy, headLen, a);
    const [l1x, l1y] = polar(hx, hy, headLen * 0.42, a - Math.PI / 2);
    const [l2x, l2y] = polar(hx, hy, headLen * 0.42, a + Math.PI / 2);
    c.add(
      `<path class="k" d="${poly([
        [cx, cy],
        [l1x, l1y],
        [l2x, l2y],
      ])}"/>`,
    );
    let fletch = '';
    for (const f of [1.3, 1.5]) {
      const [fx, fy] = polar(cx, cy, R * f, a);
      const [bx, by] = polar(cx, cy, R * (f + 0.22), a);
      for (const s of [-1, 1]) {
        const [ox, oy] = polar(bx, by, w * 0.1, a + (s * Math.PI) / 2);
        fletch += poly([
          [fx, fy],
          [ox, oy],
          [bx, by],
        ]);
      }
    }
    c.add(`<path class="b x sk" stroke-width="2.2" stroke-linejoin="round" d="${fletch}"/>`);
    c.add(baseline(w, cy + R * 1.2));
  },
};

/** Words in a project id or name that make a motif the natural pick for that team (lowercase, single words). */
export const WORK_KEYWORDS: Record<string, string[]> = {
  wrench: ['engineering', 'eng', 'production', 'maintenance', 'sustaining', 'craft'],
  puzzle: ['product', 'pm', 'prd', 'mvp', 'roadmap', 'outcomes'],
  brackets: ['developer', 'devrel', 'dx', 'sdk', 'advocacy', 'relations'],
  headset: ['ar', 'vr', 'xr', 'metaverse', 'spatial', 'immersive'],
  clipboard: ['operations', 'bizops', 'program', 'project', 'pmo', 'process'],
  cap: ['learning', 'training', 'education', 'academy', 'courses', 'mentoring'],
  laptop: ['it', 'workplace', 'office', 'facilities', 'endpoints', 'desktop'],
  target: ['marketing', 'lifecycle', 'gtm', 'targeting', 'segments', 'positioning'],
};
