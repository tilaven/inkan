import { TAU, n, circle, poly, polar } from './canvas';
import { pick, rect, circlePath, type MotifFn } from './motifs';

const gearPath = (cx: number, cy: number, Ro: number, teeth: number, phase: number) => {
  const Ri = Ro * 0.8;
  const half = TAU / teeth;
  const pts: number[][] = [];
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * half;
    pts.push(
      polar(cx, cy, Ri, a - half * 0.5),
      polar(cx, cy, Ri, a - half * 0.3),
      polar(cx, cy, Ro, a - half * 0.18),
      polar(cx, cy, Ro, a + half * 0.18),
      polar(cx, cy, Ri, a + half * 0.3),
    );
  }
  return poly(pts) + circlePath(cx, cy, Ro * 0.22);
};

/** Cover motifs for infrastructure, platform and security teams. */
export const INFRA_MOTIFS: Record<string, MotifFn> = {
  shield(c, r, p) {
    const { w, h } = c;
    const pale = p() < 0.5;
    const side = pick(p, [1, -1]);
    const cx = w * (0.46 + r() * 0.08);
    const top = h * (0.05 + r() * 0.04);
    const W = w * 0.86;
    const H = h * 0.68;
    const L = cx - W / 2;
    const R = cx + W / 2;
    const sh = top + H * 0.42;
    const bot = top + H;
    const body = `M${n(L)} ${n(top)}H${n(R)}V${n(sh)}Q${n(R)} ${n(bot - H * 0.12)} ${n(cx)} ${n(bot)}Q${n(L)} ${n(bot - H * 0.12)} ${n(L)} ${n(sh)}Z`;
    const outside = c.id();
    c.defs.push(`<clipPath id="${outside}"><path clip-rule="evenodd" d="M0 0H${n(w)}V${n(h)}H0Z${body}"/></clipPath>`);
    const pid = c.id();
    c.defs.push(
      `<pattern id="${pid}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(${side * 45})"><rect class="a x" width="7" height="14"/></pattern>`,
    );
    c.add(rect(0, 0, w, h * 0.8, ` fill="url(#${pid})" clip-path="url(#${outside})"`));
    c.add(`<path class="a x" d="${body}"/>`);
    const inside = c.clip(body);
    const half = pale
      ? rect(cx, top - 4, W, H + 8)
      : `<path d="${poly([
          [L - 4, top - 4],
          [L + W * 0.42, top - 4],
          [R + 4, bot],
          [R + 4, bot - H * 0.5],
        ])}"/>`;
    c.add(`<g class="b x" fill-opacity=".9" clip-path="url(#${inside})">${half}</g>`);
    c.halftone({
      spacing: 4.6,
      angle: 0.5,
      maxR: 2,
      cls: 'k',
      clip: inside,
      field: [
        {
          x1: side > 0 ? R : L,
          y1: 0,
          x2: side > 0 ? L + W * 0.3 : R - W * 0.3,
          y2: 0,
          amp: 0.85,
        },
      ],
    });
    c.add(`<path class="sk n" stroke-width="3.4" d="${body}"/>`);
    const my = top + H * 0.45;
    c.add(
      `<g transform="translate(${n(cx)} ${n(my)}) scale(.86) translate(${n(-cx)} ${n(-my)})"><path class="sk n" stroke-width="1.3" d="${body}"/></g>`,
    );
    if (r() < 0.5) c.add(circle(cx, my, w * 0.075, ' class="k"'));
    else {
      c.add(
        `<path class="sk n" stroke-width="4.2" d="M${n(L + W * 0.22)} ${n(my + H * 0.08)}L${n(cx)} ${n(my - H * 0.12)}L${n(R - W * 0.22)} ${n(my + H * 0.08)}"/>`,
      );
    }
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M${n(cx)} ${n(bot)}V${n(h)}"/>`);
  },

  key(c, r, p) {
    const { w, h } = c;
    const flip = p() < 0.5;
    const teeth = pick(p, [2, 3]);
    const mx = (x: number) => (flip ? w - x : x);
    const bx = mx(w * (0.28 + r() * 0.08));
    const by = h * (0.16 + r() * 0.05);
    const ang = (flip ? 180 : 0) + (flip ? -1 : 1) * (40 + r() * 14);
    const Rb = w * 0.24;
    const T = w * 0.14;
    const L = w * 1.08;
    const tw = w * 0.085;
    const td = w * 0.13;
    const gap = w * 0.05;
    const pts: number[][] = [
      [Rb - 3, -T / 2],
      [L, -T / 2],
    ];
    let x = L;
    for (let i = 0; i < teeth; i++) {
      pts.push([x, T / 2 + td], [x - tw, T / 2 + td], [x - tw, T / 2]);
      x -= tw + gap;
      if (i < teeth - 1) pts.push([x, T / 2]);
    }
    pts.push([Rb - 3, T / 2]);
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx: bx, cy: by, r: w * 0.95, pow: 1.5, amp: 1.1 },
    });
    const kx = mx(w * (0.8 + r() * 0.1));
    const ky = h * (0.08 + r() * 0.06);
    const kr = w * 0.12;
    const ka = 0.75;
    const hole = `M${n(kx - Math.cos(ka) * kr)} ${n(ky + Math.sin(ka) * kr)}A${n(kr)} ${n(kr)} 0 1 1 ${n(kx + Math.cos(ka) * kr)} ${n(ky + Math.sin(ka) * kr)}L${n(kx + kr * 0.9)} ${n(ky + kr * 2.4)}H${n(kx - kr * 0.9)}Z`;
    c.add(`<path class="b x sk" stroke-width="2.4" d="${hole}"/>`);
    const place = `translate(${n(bx)} ${n(by)}) rotate(${n(ang)})`;
    c.add(
      `<g transform="${place}"><path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M${n(-w)} 0H${n(2 * w)}"/></g>`,
    );
    c.add(`<g transform="${place}"><path class="a x sk" stroke-width="2.6" d="${poly(pts)}"/></g>`);
    c.add(
      `<path class="a x sk" stroke-width="3" fill-rule="evenodd" d="${circlePath(bx, by, Rb)}${circlePath(bx, by, Rb * 0.42)}"/>`,
    );
    c.halftone({
      spacing: 4.2,
      angle: 0.7,
      maxR: 1.7,
      cls: 'k',
      clip: c.clip(circlePath(bx, by, Rb)),
      field: {
        cx: bx + (flip ? Rb : -Rb) * 0.6,
        cy: by + Rb * 0.6,
        r: Rb * 1.6,
        pow: 1.2,
        amp: 0.9,
      },
    });
    c.add(circle(bx, by, Rb * 0.42, ' class="sk n" stroke-width="2"'));
  },

  mesh(c, r, p) {
    const { w, h } = c;
    const count = pick(p, [6, 8]);
    const dashed = p() < 0.5;
    const hx = w * (0.4 + r() * 0.2);
    const hy = h * (0.3 + r() * 0.08);
    const Rh = w * 0.15;
    const a0 = r() * TAU;
    const nodes: { x: number; y: number; rad: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = a0 + (i * TAU) / count + (r() - 0.5) * 0.5;
      const dist = w * (0.32 + r() * 0.22);
      nodes.push({
        x: hx + Math.cos(a) * dist,
        y: hy + Math.sin(a) * dist,
        rad: w * (0.05 + r() * 0.035),
      });
    }
    c.halftone({
      spacing: 5,
      angle: 0.4,
      maxR: 2.6,
      cls: 'a',
      field: { cx: hx, cy: hy, r: w * 0.9, pow: 1.4, amp: 1.1 },
    });
    let spokes = '';
    let ring = '';
    let packets = '';
    nodes.forEach((v, i) => {
      spokes += `M${n(hx)} ${n(hy)}L${n(v.x)} ${n(v.y)}`;
      const u = nodes[(i + 1) % count];
      ring += `M${n(v.x)} ${n(v.y)}L${n(u.x)} ${n(u.y)}`;
      if (r() < 0.4) packets += circle(hx + (v.x - hx) * 0.55, hy + (v.y - hy) * 0.55, 3.2);
    });
    c.add(`<path class="sk n" stroke-width="2.6" d="${spokes}"/>`);
    c.add(`<path class="sk n" stroke-width="1.3"${dashed ? ' stroke-dasharray="3 4"' : ''} d="${ring}"/>`);
    c.add(`<g class="k">${packets}</g>`);
    const hi = Math.floor(r() * count);
    const dk = (hi + 1 + Math.floor(r() * (count - 1))) % count;
    let dots = '';
    nodes.forEach((v, i) => {
      dots += circle(v.x, v.y, v.rad, ` class="${i === hi ? 'b x' : i === dk ? 'k' : 'a x'} sk" stroke-width="2"`);
    });
    c.add(dots);
    c.add(circle(hx, hy, Rh, ' class="b x"'));
    c.halftone({
      spacing: 4,
      angle: 0.6,
      maxR: 1.7,
      cls: 'k',
      clip: c.clip(circlePath(hx, hy, Rh)),
      field: {
        cx: hx + Rh * 0.6,
        cy: hy + Rh * 0.6,
        r: Rh * 1.6,
        pow: 1.2,
        amp: 0.95,
      },
    });
    c.add(
      circle(hx, hy, Rh, ' class="sk n" stroke-width="3.4"') +
        circle(hx, hy, Rh * 0.55, ' class="sk n" stroke-width="1.2"'),
    );
    c.add(circle(hx, hy, w * 0.035, ' class="k"'));
  },

  cloud(c, r, p) {
    const { w, h } = c;
    const rain = p() < 0.5;
    const sunX = w * pick(p, [0.2, 0.8]);
    const yb = h * (0.46 + r() * 0.08);
    const peaks = [
      [-0.1, 0],
      [0.18, 0.11 + r() * 0.04],
      [0.5, 0.18 + r() * 0.05],
      [0.8, 0.1 + r() * 0.04],
      [1.1, 0],
    ].map(([tx, ty]) => [w * tx, yb - h * ty]);
    let d = `M${n(peaks[0][0])} ${n(peaks[0][1])}`;
    for (let i = 1; i < peaks.length; i++) {
      const [x, y] = peaks[i];
      const chord = Math.hypot(x - peaks[i - 1][0], y - peaks[i - 1][1]);
      const R = chord * (0.52 + r() * 0.08);
      d += `A${n(R)} ${n(R)} 0 0 1 ${n(x)} ${n(y)}`;
    }
    d += 'Z';
    c.halftone({
      spacing: 5,
      angle: 0.5,
      maxR: 2.2,
      cls: 'k',
      field: [{ x1: 0, y1: yb - h * 0.3, x2: 0, y2: 0, amp: 0.8 }],
    });
    const sunR = w * 0.17;
    c.add(
      circle(sunX, h * 0.13, sunR, ' class="b x"') + circle(sunX, h * 0.13, sunR, ' class="sk n" stroke-width="3"'),
    );
    c.add(`<path class="a x" d="${d}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.7,
      maxR: 2,
      cls: 'k',
      clip: c.clip(d),
      field: [{ x1: 0, y1: yb - h * 0.26, x2: 0, y2: yb, amp: 0.9 }],
    });
    c.add(`<path class="sk n" stroke-width="3.4" d="${d}"/>`);
    if (rain) {
      let drops = '';
      for (let i = 0; i < 7; i++) {
        const x = w * (0.1 + i * 0.13) + r() * 8;
        drops += `M${n(x)} ${n(yb + h * 0.05)}l${n(-w * 0.07)} ${n(h * 0.14)}`;
      }
      c.add(`<path class="sk n" stroke-width="2.6" stroke-dasharray="9 7" d="${drops}"/>`);
    } else {
      const x = w * (0.35 + r() * 0.3);
      const y = yb - h * 0.02;
      const s = w * 0.07;
      c.add(
        `<path class="k" d="${poly([
          [x, y],
          [x - s, y + s * 2.1],
          [x + s * 0.25, y + s * 2.1],
          [x - s * 0.6, y + s * 4.2],
          [x + s * 1.1, y + s * 1.7],
          [x + s * 0.1, y + s * 1.7],
        ])}"/>`,
      );
    }
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M0 ${n(h * 0.78)}H${n(w)}"/>`);
  },

  pipeline(c, r, p) {
    const { w, h } = c;
    const flip = p() < 0.5;
    const altX = w * pick(p, [0.16, 0.84]);
    const mx = (x: number) => (flip ? w - x : x);
    const T = w * 0.19;
    const y1 = h * (0.14 + r() * 0.08);
    const y2 = h * (0.5 + r() * 0.12);
    const x1 = w * (0.5 + r() * 0.16);
    const main = poly(
      [
        [-10, y1 - T / 2],
        [x1 + T / 2, y1 - T / 2],
        [x1 + T / 2, y2 - T / 2],
        [w + 10, y2 - T / 2],
        [w + 10, y2 + T / 2],
        [x1 - T / 2, y2 + T / 2],
        [x1 - T / 2, y1 + T / 2],
        [-10, y1 + T / 2],
      ].map(([x, y]) => [mx(x), y]),
    );
    const alt = rect(mx(altX) - T * 0.4, -10, T * 0.8, h * 0.82 + 10);
    c.add(`<g class="b x sk" stroke-width="2">${alt}</g>`);
    let altArrows = '';
    for (let y = h * 0.08; y < h * 0.76; y += h * 0.12) {
      altArrows += `M${n(mx(altX) - T * 0.2)} ${n(y)}L${n(mx(altX))} ${n(y + T * 0.2)}L${n(mx(altX) + T * 0.2)} ${n(y)}`;
    }
    c.add(`<path class="sk n" stroke-width="2.2" d="${altArrows}"/>`);
    c.add(`<path class="a x" d="${main}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.3,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(main),
      field: [{ x1: mx(x1 - T), y1: y1, x2: mx(w), y2: y2 + T / 2, amp: 0.9 }],
    });
    c.add(`<path class="sk n" stroke-width="3" d="${main}"/>`);
    const s = T * 0.28;
    const dir = flip ? -1 : 1;
    let arrows = '';
    for (let x = w * 0.08; x < x1 - T; x += w * 0.15) {
      arrows += `M${n(mx(x))} ${n(y1 - s)}L${n(mx(x) + dir * s)} ${n(y1)}L${n(mx(x))} ${n(y1 + s)}`;
    }
    for (let y = y1 + T * 0.9; y < y2 - T * 0.8; y += h * 0.09) {
      arrows += `M${n(mx(x1) - s)} ${n(y)}L${n(mx(x1))} ${n(y + s)}L${n(mx(x1) + s)} ${n(y)}`;
    }
    for (let x = x1 + T; x < w; x += w * 0.15) {
      arrows += `M${n(mx(x))} ${n(y2 - s)}L${n(mx(x) + dir * s)} ${n(y2)}L${n(mx(x))} ${n(y2 + s)}`;
    }
    c.add(`<path class="sk n" stroke-width="3" d="${arrows}"/>`);
    const flange = (x: number, y: number, vertical: boolean) =>
      vertical
        ? rect(x - T / 2 - 4, y - 4, T + 8, 8, ' class="k"')
        : rect(x - 4, y - T / 2 - 4, 8, T + 8, ' class="k"');
    c.add(
      flange(mx(w * 0.22 + r() * 10), y1, false) +
        flange(mx(x1), (y1 + y2) / 2 + T * 0.3, true) +
        flange(mx(w * 0.84 - r() * 10), y2, false),
    );
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(h * 0.78)}H${n(w)}"/>`);
  },

  gear(c, r, p) {
    const { w, h } = c;
    const teeth = pick(p, [8, 12]);
    const corner = pick(p, [-0.9, 2.3]);
    const cx = w * (0.42 + r() * 0.16);
    const cy = h * (0.3 + r() * 0.1);
    const Ro = w * 0.42;
    const phase = r() * TAU;
    c.halftone({
      spacing: 5,
      angle: 0.3,
      maxR: 2.6,
      cls: 'a',
      field: { cx, cy, r: w * 0.95, pow: 1.5, amp: 1.1 },
    });
    const Ro2 = w * 0.25;
    const [sx, sy] = polar(cx, cy, Ro + Ro2 * 0.82, corner);
    const small = gearPath(sx, sy, Ro2, Math.round((teeth * Ro2) / Ro), phase + corner);
    c.add(`<path class="b x sk" stroke-width="2.4" fill-rule="evenodd" d="${small}"/>`);
    const big = gearPath(cx, cy, Ro, teeth, phase);
    c.add(`<path class="a x sk" stroke-width="3.2" fill-rule="evenodd" d="${big}"/>`);
    c.halftone({
      spacing: 4.4,
      angle: 0.6,
      maxR: 2,
      cls: 'k',
      clip: c.clip(big),
      field: {
        cx: cx + Ro * 0.5,
        cy: cy + Ro * 0.6,
        r: Ro * 1.5,
        pow: 1.3,
        amp: 0.95,
      },
    });
    let spokes = '';
    for (let i = 0; i < 3; i++) {
      const [x1, y1] = polar(cx, cy, Ro * 0.3, phase + (i * TAU) / 3);
      const [x2, y2] = polar(cx, cy, Ro * 0.62, phase + (i * TAU) / 3);
      spokes += `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;
    }
    c.add(
      circle(cx, cy, Ro * 0.62, ' class="sk n" stroke-width="1.3"') +
        `<path class="sk n" stroke-width="3" d="${spokes}"/>`,
    );
    c.add(`<path class="sk n" stroke-width="1.2" stroke-dasharray="3 4" d="M${n(cx)} 0V${n(h)}"/>`);
  },

  rack(c, r, p) {
    const { w, h } = c;
    const ledLeft = p() < 0.5;
    const units = pick(p, [5, 7]);
    const x0 = w * (0.08 + r() * 0.06);
    const x1 = w * (0.92 - r() * 0.06);
    const top = -6;
    const bot = h * 0.8;
    const rail = w * 0.055;
    const ix0 = x0 + rail;
    const ix1 = x1 - rail;
    const y0 = h * 0.045;
    const uh = (bot - y0) / units;
    const hi = Math.floor(r() * units);
    const dk = (hi + 1 + Math.floor(r() * (units - 1))) % units;
    let slabs = '';
    let marks = '';
    let vents = '';
    for (let i = 0; i < units; i++) {
      const y = y0 + i * uh;
      const cls = i === hi ? 'b x' : i === dk ? 'k' : 'a x';
      slabs += rect(ix0 + 2, y + 2, ix1 - ix0 - 4, uh - 4, ` class="${cls} sk" stroke-width="1.5"`);
      const lx = ledLeft ? ix0 + w * 0.07 : ix1 - w * 0.07;
      for (let j = 0; j < 3; j++) {
        const on = r() < 0.6;
        marks += circle(
          lx + (ledLeft ? 1 : -1) * j * w * 0.055,
          y + uh / 2,
          3.4,
          ` class="${i === dk ? 'p' : on ? 'k' : 'p'}"`,
        );
      }
      const vx = ledLeft ? ix1 - w * 0.08 : ix0 + w * 0.08;
      for (let k = -2; k <= 2; k++) vents += `M${n(vx + k * 5)} ${n(y + uh * 0.28)}V${n(y + uh * 0.72)}`;
      if (i === hi)
        marks += rect(ledLeft ? ix1 - w * 0.32 : ix0 + w * 0.14, y + uh * 0.36, w * 0.16, uh * 0.28, ' class="k"');
    }
    c.add(slabs);
    c.halftone({
      spacing: 4.4,
      angle: 0.4,
      maxR: 1.9,
      cls: 'k',
      clip: c.clip(`M${n(ix0)} ${n(y0)}H${n(ix1)}V${n(bot)}H${n(ix0)}Z`),
      field: [
        ledLeft
          ? { x1: ix1, y1: 0, x2: ix0 + w * 0.3, y2: 0, amp: 0.8 }
          : { x1: ix0, y1: 0, x2: ix1 - w * 0.3, y2: 0, amp: 0.8 },
      ],
    });
    c.add(marks + `<path class="sk n" stroke-width="1.3" d="${vents}"/>`);
    c.add(rect(x0, top, x1 - x0, bot - top, ' class="sk n" stroke-width="3"'));
    let screws = '';
    for (let i = 0; i <= units; i++)
      screws += circle(x0 + rail / 2, y0 + i * uh, 2.2) + circle(x1 - rail / 2, y0 + i * uh, 2.2);
    c.add(
      `<path class="sk n" stroke-width="1.4" d="M${n(ix0)} ${n(top)}V${n(bot)}M${n(ix1)} ${n(top)}V${n(bot)}"/><g class="k">${screws}</g>`,
    );
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(bot + 8)}H${n(w)}"/>`);
  },

  queue(c, r, p) {
    const { w, h } = c;
    const flip = p() < 0.5;
    const tilt = pick(p, [-4, 4]);
    const mx = (x: number) => (flip ? w - x : x);
    const bs = w * 0.13;
    const dkLane = Math.floor(r() * 3);
    let rails = '';
    let boxes = '';
    let dark = '';
    let heads = '';
    for (let lane = 0; lane < 3; lane++) {
      const y = h * (0.13 + lane * 0.25) + (r() - 0.5) * h * 0.03;
      rails += `M${n(-w * 0.3)} ${n(y - bs * 0.75)}H${n(w * 1.3)}M${n(-w * 0.3)} ${n(y + bs * 0.75)}H${n(w * 1.3)}`;
      const dkBox = lane === dkLane ? Math.floor(r() * 3) : -1;
      const skip = Math.floor(r() * 5);
      for (let i = 0, x = w * (0.3 + r() * 0.06); x < w * 0.82; i++, x += bs * 1.45) {
        if (i === skip) continue;
        const box = rect(
          mx(x) - (flip ? bs : 0),
          y - bs / 2,
          bs,
          bs,
          i === dkBox ? '' : ' class="a x sk" stroke-width="1.6"',
        );
        if (i === dkBox) dark += box;
        else boxes += box;
      }
      const tip = mx(w * 0.99);
      const back = mx(w * 0.99 - bs * 1.1);
      heads += poly([
        [back, y - bs * 0.75],
        [tip, y],
        [back, y + bs * 0.75],
      ]);
    }
    const place = `rotate(${tilt} ${n(w / 2)} ${n(h / 2)})`;
    c.halftone({
      spacing: 5,
      angle: 0.6,
      maxR: 2.2,
      cls: 'k',
      field: [{ x1: 0, y1: h * 0.45, x2: 0, y2: h * 0.8, amp: 0.8 }],
    });
    c.add(
      `<g transform="${place}"><path class="sk n" stroke-width="2.4" d="${rails}"/>${boxes}<g class="k">${dark}</g><path class="k" d="${heads}"/></g>`,
    );
    const bx = mx(w * 0.02);
    const by = h * (0.34 + r() * 0.1);
    const R = w * 0.3;
    c.add(circle(bx, by, R, ' class="b x"'));
    c.halftone({
      spacing: 4.2,
      angle: 0.8,
      maxR: 1.8,
      cls: 'k',
      clip: c.clip(circlePath(bx, by, R)),
      field: {
        cx: bx + (flip ? -R : R) * 0.5,
        cy: by + R * 0.6,
        r: R * 1.6,
        pow: 1.2,
        amp: 0.9,
      },
    });
    c.add(
      circle(bx, by, R, ' class="sk n" stroke-width="3.4"') +
        circle(bx, by, R * 0.55, ' class="sk n" stroke-width="1.3"'),
    );
    c.add(circle(bx, by, w * 0.04, ' class="k"'));
  },

  lens(c, r, p) {
    const { w, h } = c;
    const handle = pick(p, [0.78, 2.36]);
    const bold = p() < 0.5;
    const cx = w * (0.42 + r() * 0.16);
    const cy = h * (0.3 + r() * 0.06);
    const R = w * 0.33;
    const glass = R * 0.82;
    let lines = '';
    const lh = bold ? 5 : 3.6;
    for (let y = h * 0.07; y < h * 0.78; y += h * 0.055) lines += rect(w * 0.08, y, w * (0.3 + r() * 0.6), lh);
    c.add(`<g class="k">${lines}</g>`);
    const inner = circlePath(cx, cy, glass);
    const clip = c.clip(inner);
    c.add(circle(cx, cy, glass, ' class="b x" fill-opacity=".85"'));
    const hit = h * (0.07 + 0.055 * Math.round((cy - h * 0.07) / h / 0.055));
    c.add(
      `<g clip-path="url(#${clip})"><g transform="translate(${n(cx)} ${n(cy)}) scale(1.9) translate(${n(-cx)} ${n(-cy)})">${rect(0, hit - h * 0.014, w, h * 0.035, ' class="a x"')}<g class="k">${lines}</g></g></g>`,
    );
    c.halftone({
      spacing: 4.2,
      angle: 0.5,
      maxR: 1.8,
      cls: 'k',
      clip,
      field: {
        cx: cx + glass * 0.6,
        cy: cy + glass * 0.6,
        r: glass * 1.5,
        pow: 1.3,
        amp: 0.9,
      },
    });
    c.add(circle(cx - glass * 0.45, cy - glass * 0.45, glass * 0.14, ' class="p"'));
    const T = w * 0.1;
    const [hx, hy] = polar(cx, cy, R * 0.9, handle);
    const hd = `translate(${n(hx)} ${n(hy)}) rotate(${n((handle * 180) / Math.PI)})`;
    c.add(
      `<g transform="${hd}">${rect(0, -T / 2, w * 0.9, T, ' class="k"')}${rect(T * 0.3, -T * 0.14, w * 0.9, T * 0.28, ' class="p"')}</g>`,
    );
    c.add(`<path class="a x sk" stroke-width="2.6" fill-rule="evenodd" d="${circlePath(cx, cy, R)}${inner}"/>`);
  },

  terminal(c, r, p) {
    const { w, h } = c;
    const shadow = pick(p, [1, -1]);
    const bigPrompt = p() < 0.5;
    const x0 = w * (0.05 + r() * 0.04);
    const x1 = w * (0.95 - r() * 0.04);
    const y0 = h * (0.07 + r() * 0.05);
    const y1 = h * 0.82;
    const bar = h * 0.07;
    const win = `M${n(x0)} ${n(y0)}H${n(x1)}V${n(y1)}H${n(x0)}Z`;
    c.add(rect(x0 + shadow * 9, y0 + 9, x1 - x0, y1 - y0, ' class="b x" rx="6"'));
    c.add(rect(x0, y0, x1 - x0, y1 - y0, ' class="a x" rx="6"'));
    c.halftone({
      spacing: 4.6,
      angle: 0.4,
      maxR: 2,
      cls: 'k',
      clip: c.clip(win),
      field: [
        {
          x1: shadow > 0 ? x0 + w * 0.3 : x1 - w * 0.3,
          y1: y0 + h * 0.2,
          x2: shadow > 0 ? x1 : x0,
          y2: y1,
          amp: 0.8,
        },
      ],
    });
    c.add(rect(x0, y0, x1 - x0, bar, ' class="k" rx="6"') + rect(x0, y0 + bar / 2, x1 - x0, bar / 2, ' class="k"'));
    let dots = '';
    for (let i = 0; i < 3; i++) dots += circle(x0 + 12 + i * 13, y0 + bar / 2, 4);
    c.add(`<g class="p">${dots}</g>`);
    const s = w * (bigPrompt ? 0.2 : 0.15);
    const px = x0 + w * 0.08;
    const py = y0 + bar + h * 0.05;
    c.add(
      `<path class="sk n" stroke-width="${n(w * 0.045)}" stroke-linecap="square" d="M${n(px)} ${n(py)}L${n(px + s)} ${n(py + s * 0.75)}L${n(px)} ${n(py + s * 1.5)}"/>`,
    );
    c.add(rect(px + s + w * 0.07, py + s * 0.5, w * 0.13, s, ' class="k"'));
    let lines = '';
    const hl = Math.floor(r() * 3);
    for (let i = 0, y = py + s * 1.5 + h * 0.06; y < y1 - h * 0.04; i++, y += h * 0.055) {
      const len = (x1 - x0) * (0.2 + r() * 0.6);
      lines += i === hl ? rect(px, y - 2, len, 9, ' class="b x"') : rect(px, y, len, 5, ' class="k"');
    }
    c.add(lines);
    c.add(rect(x0, y0, x1 - x0, y1 - y0, ' class="sk n" stroke-width="3" rx="6"'));
    c.add(`<path class="sk n" stroke-width="1.6" stroke-dasharray="2 5" d="M0 ${n(y1 + 10)}H${n(w)}"/>`);
  },
};

/** Words in a project id or name that make a motif the natural pick for that team (lowercase, single words). */
export const INFRA_KEYWORDS: Record<string, string[]> = {
  shield: ['security', 'sec', 'secops', 'appsec', 'infosec', 'trust', 'compliance', 'privacy'],
  key: ['identity', 'iam', 'auth', 'sso', 'access', 'login', 'accounts', 'oauth'],
  mesh: ['network', 'networking', 'edge', 'cdn', 'mesh', 'dns', 'vpc', 'connectivity'],
  cloud: ['cloud', 'aws', 'gcp', 'azure', 'hosting', 'cloudops', 'finops'],
  pipeline: ['ci', 'cd', 'cicd', 'devops', 'pipeline', 'release', 'delivery', 'build'],
  gear: ['devex', 'tooling', 'tools', 'internal', 'productivity', 'automation', 'enablement'],
  rack: ['backend', 'servers', 'compute', 'hardware', 'datacenter', 'baremetal', 'services'],
  queue: ['messaging', 'events', 'kafka', 'async', 'queue', 'pubsub', 'eventing'],
  lens: ['search', 'discovery', 'relevance', 'indexing', 'ranking', 'browse', 'seo', 'sem'],
  terminal: ['cli', 'ops', 'terminal', 'shell', 'console', 'scripts', 'oncall', 'runbooks'],
  discs: ['dbre', 'database', 'db', 'storage', 'postgres', 'mysql', 'sql'],
  rings: ['sre', 'observability', 'monitoring', 'reliability', 'o11y', 'telemetry'],
  cubes: ['k8s', 'kubernetes', 'containers', 'infrastructure', 'orchestration'],
  lattice: ['platform', 'infra', 'core', 'foundation'],
};
