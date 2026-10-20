import { defineMotif } from '@tilaven/inkan';
import { circle, n, TAU } from '@tilaven/inkan/covers';

/** A rubber stamp: a ticked ring over a halftone cloud, with a black seal off to one side. */
export default defineMotif((c, record, project) => {
  const { w, h } = c;
  const side = project() < 0.5 ? 0.3 : 0.7;
  const teeth = 24 + Math.floor(project() * 3) * 8;
  const cx = w * (side + (record() - 0.5) * 0.12);
  const cy = h * (0.3 + record() * 0.12);
  const R = w * (0.26 + record() * 0.06);
  const tilt = (record() - 0.5) * 0.6;

  c.halftone({ spacing: 5, angle: 0.6, maxR: 2.6, cls: 'a', field: { cx, cy, r: w * 0.9, pow: 1.3, amp: 1.1 } });
  c.add(circle(cx, cy, R, ' class="b x"'));
  c.add(circle(cx, cy, R * 1.18, ` class="sa n x" stroke-width="${n(R * 0.14)}"`));
  let ticks = '';
  for (let i = 0; i < teeth; i++) {
    const a = tilt + (i / teeth) * TAU;
    const r0 = R * 1.3;
    const r1 = R * (i % 4 === 0 ? 1.55 : 1.42);
    ticks += `M${n(cx + Math.cos(a) * r0)} ${n(cy + Math.sin(a) * r0)}L${n(cx + Math.cos(a) * r1)} ${n(cy + Math.sin(a) * r1)}`;
  }
  c.add(`<path class="sk n" stroke-width="1.6" d="${ticks}"/>`);
  c.add(circle(cx, cy, R * 0.62, ' class="sk n" stroke-width="2.4"'));
  c.add(`<path class="sk n" stroke-width="1.2" d="M${n(cx - R * 0.5)} ${n(cy)}H${n(cx + R * 0.5)}M${n(cx)} ${n(cy - R * 0.5)}V${n(cy + R * 0.5)}"/>`);
  const seal = tilt + TAU * (0.6 + record() * 0.3);
  c.add(circle(cx + Math.cos(seal) * R * 1.9, cy + Math.sin(seal) * R * 1.9, w * 0.05, ' class="k"'));
}, { keywords: ['audit', 'controls', 'sox'] });
