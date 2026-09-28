// Pie gauge ("Torte"): an outline circle and a filled wedge from 12 o'clock clockwise, with a gap
// between the two. Sonos Controller's volume look on keys and dials.
import { clamp01 } from "./arc.js";

export type PieOptions = {
    /** Radius of the wedge; default 0.79 × r, rounded (Sonos Controller: 7 of 9 on keys, 30 of 38 on dials). */
    inner?: number;
    /** Stroke width of the outline; default 0.16 × r in half pixels (1.5 of 9 on keys, 6 of 38 on dials). */
    stroke?: number;
};

/** SVG parts of a pie gauge (value 0..1) with outer radius `r`, centered at (cx, cy). */
export function pie(cx: number, cy: number, r: number, value: number, color: string, opts: PieOptions = {}): string[] {
    const inner = opts.inner ?? Math.round(r * 0.79);
    const stroke = opts.stroke ?? Math.round(r * 0.32) / 2;
    const v = clamp01(value);
    const parts = [`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`];
    if (v >= 0.999) {
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${inner}" fill="${color}"/>`);
    } else if (v > 0.001) {
        const angle = v * 2 * Math.PI;
        const x = cx + inner * Math.sin(angle);
        const y = cy - inner * Math.cos(angle);
        const largeArc = v > 0.5 ? 1 : 0;
        parts.push(`<path d="M ${cx} ${cy} L ${cx} ${cy - inner} A ${inner} ${inner} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="${color}"/>`);
    }
    return parts;
}

