// Half-circle gauge: a 180° track from 9 o'clock over the top to 3 o'clock, colour zones as dim
// bands on the track, the actual value as a filled arc in its zone's colour, and an optional target
// marker (a setpoint, e.g. a thermostat's). Values are in the caller's unit between min and max.
import { clamp01 } from "./arc.js";
import { zoneColor, type Zones } from "./scale.js";

export type HalfArcOptions = {
    /** Centre of the circle; the arc lies above it. */
    cx: number;
    cy: number;
    /** Radius to the middle of the track. */
    r: number;
    /** Track width (default 12). */
    width?: number;
    min: number;
    max: number;
    /** The actual value; no fill when undefined. */
    value?: number;
    /** The target (setpoint); no marker when undefined. */
    target?: number;
    /** Colour zones in the value's unit; each applies from `from` upwards. */
    zones?: Zones;
    /** Fill colour without zones (default white). */
    color?: string;
    /** Track colour behind zones and fill. */
    track?: string;
    /** How strongly the zones show on the track (0..1, default 0.35). */
    zoneOpacity?: number;
    /** Target marker colour (default white). */
    marker?: string;
};

/** Position 0..1 of a value between min and max (clamped; 0 for an empty range). */
export function halfArcPosition(value: number, min: number, max: number): number {
    return max > min ? clamp01((value - min) / (max - min)) : 0;
}

/** The point on the half circle at position p (0 = left end, 1 = right end). */
export function halfArcPoint(cx: number, cy: number, r: number, p: number): [number, number] {
    const a = Math.PI * (1 + clamp01(p));
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG parts of the gauge, back to front: track, zone bands, fill, target marker. */
export function halfArc(o: HalfArcOptions): string[] {
    const width = o.width ?? 12;
    const pos = (v: number) => halfArcPosition(v, o.min, o.max);
    const path = (from: number, to: number) => {
        const [x1, y1] = halfArcPoint(o.cx, o.cy, o.r, from);
        const [x2, y2] = halfArcPoint(o.cx, o.cy, o.r, to);
        return `M ${f(x1)} ${f(y1)} A ${o.r} ${o.r} 0 0 1 ${f(x2)} ${f(y2)}`;
    };
    const stroke = (d: string, color: string, extra = "") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${extra}/>`;
    const parts = [stroke(path(0, 1), o.track ?? "#2c2c30")];

    const zones = o.zones?.length ? o.zones : undefined;
    if (zones) {
        // Each zone runs from its start to the next one's (the first also covers everything below)
        zones.forEach((z, i) => {
            const from = i === 0 ? 0 : pos(z.from);
            const to = i + 1 < zones.length ? pos(zones[i + 1].from) : 1;
            if (to > from) parts.push(stroke(path(from, to), z.color, ` opacity="${o.zoneOpacity ?? 0.35}"`));
        });
    }

    if (o.value !== undefined && Number.isFinite(o.value)) {
        const p = pos(o.value);
        const color = zones ? zoneColor(o.value, zones) : (o.color ?? "#ffffff");
        if (p > 0) parts.push(stroke(path(0, p), color));
    }

    if (o.target !== undefined && Number.isFinite(o.target)) {
        // A tick across the track and a small triangle outside it, pointing at the track
        const p = pos(o.target);
        const ink = o.marker ?? "#ffffff";
        const [ix, iy] = halfArcPoint(o.cx, o.cy, o.r - width / 2 - 2, p);
        const [ox, oy] = halfArcPoint(o.cx, o.cy, o.r + width / 2 + 2, p);
        const [tx, ty] = halfArcPoint(o.cx, o.cy, o.r + width / 2 + 9, p);
        const a = Math.PI * (1 + p);
        const nx = -Math.sin(a) * 5;
        const ny = Math.cos(a) * 5;
        parts.push(`<line x1="${f(ix)}" y1="${f(iy)}" x2="${f(ox)}" y2="${f(oy)}" stroke="#000000" stroke-opacity="0.6" stroke-width="6" stroke-linecap="round"/>`);
        parts.push(`<line x1="${f(ix)}" y1="${f(iy)}" x2="${f(ox)}" y2="${f(oy)}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`);
        parts.push(`<path d="M ${f(ox)} ${f(oy)} L ${f(tx + nx)} ${f(ty + ny)} L ${f(tx - nx)} ${f(ty - ny)} Z" fill="${ink}"/>`);
    }
    return parts;
}

const f = (n: number) => n.toFixed(2);
