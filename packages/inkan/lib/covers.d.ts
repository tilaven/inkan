/** Full turn in radians. */
export declare const TAU: number;
/** Radians to degrees. */
export declare const DEG: number;
/** A number as an SVG attribute value: one decimal, no `-0`. */
export declare function n(v: number): string;
/** A `<circle>` element; `attrs` is raw attribute markup, e.g. ` class="k"`. */
export declare function circle(cx: number, cy: number, r: number, attrs?: string): string;
