// Open ring gauge: a ring open at the bottom (270°, from bottom left over the top to bottom right),
// as Home Assistant draws its thermostat and light cards. The arc fills from the start up to the
// value in its zone's colour; a handle can mark the value (what the dial sets), a small dot a second
// value (a thermostat's room temperature). Text inside is up to the caller.
import { clamp01 } from "./arc.js";
import { zoneColor, type Zones } from "./scale.js";

export type OpenRingOptions = {
    cx: number;
    cy: number;
    r: number;
    /** Stroke width of the ring; default 6. */
    width?: number;
    min: number;
    max: number;
    /** The value the arc fills up to (and the handle sits on); undefined: nothing filled. */
    value?: number;
    /** A second value, drawn as a small dot on the ring (e.g. the room temperature). */
    dot?: number;
    zones: Zones;
    /** Draw a handle on the value (the dial sets it). */
    handle?: boolean;
    /** Dimmed: grey, no fill (off or offline). */
    dim?: boolean;
    track?: string;
    dimColor?: string;
    /** Show the zones as faint bands on the track (0..1, like the half arc's); none when unset. */
    zoneOpacity?: number;
};

const START = 135;
const SWEEP = 270;

/** Where on the ring a fraction (0–1) of the range sits. */
export function openRingPoint(cx: number, cy: number, r: number, f: number): [number, number] {
    const a = ((START + SWEEP * clamp01(f)) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(o: OpenRingOptions, f0: number, f1: number, color: string, width: number, cap: "round" | "butt" = "round"): string {
    const [x0, y0] = openRingPoint(o.cx, o.cy, o.r, f0);
    const [x1, y1] = openRingPoint(o.cx, o.cy, o.r, f1);
    const large = (f1 - f0) * SWEEP > 180 ? 1 : 0;
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${o.r} ${o.r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}"/>`;
}

/** SVG parts of the open ring. */
export function openRing(o: OpenRingOptions): string[] {
    const width = o.width ?? 6;
    const span = o.max - o.min || 1;
    const frac = (v: number | undefined) => (v === undefined ? undefined : clamp01((v - o.min) / span));
    const dimColor = o.dimColor ?? "#6a6a70";
    const parts = [arcPath(o, 0, 1, o.track ?? "#2e2e33", width)];
    // The colour ranges as faint bands, so it reads like a scale (e.g. CO2: green, yellow, red).
    // Drawn opaque in one group that is faded as a whole, so bands never overlap darker; square
    // where they meet, round only at the ring's two ends (the first band's start, a cap at the end).
    if (o.zoneOpacity !== undefined && !o.dim) {
        const bands: string[] = [];
        let last: { to: number; color: string } | undefined;
        o.zones.forEach((z, i) => {
            const from = i === 0 ? 0 : (frac(z.from) ?? 0);
            const to = i + 1 < o.zones.length ? (frac(o.zones[i + 1].from) ?? 1) : 1;
            if (to <= from) return;
            bands.push(arcPath(o, from, to, z.color, width, bands.length === 0 ? "round" : "butt"));
            last = { to, color: z.color };
        });
        if (last && last.to >= 1) {
            const [x, y] = openRingPoint(o.cx, o.cy, o.r, 1);
            bands.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${last.color}"/>`);
        }
        if (bands.length) parts.push(`<g opacity="${o.zoneOpacity}">${bands.join("")}</g>`);
    }
    const f = frac(o.value);
    if (!o.dim && f !== undefined && f > 0.002) parts.push(arcPath(o, 0, f, zoneColor(o.value!, o.zones), width));
    const fd = frac(o.dot);
    if (fd !== undefined) {
        const [x, y] = openRingPoint(o.cx, o.cy, o.r, fd);
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${o.dim ? dimColor : "#c8c8cc"}"/>`);
    }
    if (o.handle && f !== undefined) {
        const [x, y] = openRingPoint(o.cx, o.cy, o.r, f);
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(width + 0.5).toFixed(1)}" fill="${o.dim ? "#8a8a90" : "#ffffff"}" stroke="#0a0a0a" stroke-width="2"/>`);
    }
    return parts;
}
