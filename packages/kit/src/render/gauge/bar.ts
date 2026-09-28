// Segmented meter bars (LED look), lying or standing, one per channel: mono draws one bar, stereo
// two side by side. Returns SVG parts, like arc() and pie().
import { METER_SCALE, METER_ZONES, scalePosition, zoneColor, type ScalePoints, type Zones } from "./scale.js";

export type MeterBarOptions = {
    x: number;
    y: number;
    /** Along the bar (width when lying, height when standing). */
    length: number;
    /** Across all bars together (height when lying, width when standing). */
    thickness: number;
    orientation?: "horizontal" | "vertical";
    /** Levels in dB, one per channel: [mono] or [left, right]. */
    levels: readonly number[];
    /** Peak hold per channel (same order), drawn as a line. */
    peaks?: readonly number[];
    segments?: number;
    /** Gap between segments and between channel bars. */
    gap?: number;
    scale?: ScalePoints;
    zones?: Zones;
    /** Colour of unlit segments. */
    off?: string;
};

export function meterBar(o: MeterBarOptions): string[] {
    const horizontal = (o.orientation ?? "horizontal") === "horizontal";
    const segments = o.segments ?? 36;
    const gap = o.gap ?? 1.2;
    const scale = o.scale ?? METER_SCALE;
    const zones = o.zones ?? METER_ZONES;
    const channels = Math.max(1, o.levels.length);
    const across = (o.thickness - gap * 2 * (channels - 1)) / channels;
    const seg = (o.length - gap * (segments - 1)) / segments;
    // The dB value at the top end of segment i, to pick its zone colour
    const segDb = (i: number) => dbAt((i + 1) / segments, scale);
    const parts: string[] = [];

    o.levels.forEach((level, ch) => {
        const lit = scalePosition(level, scale);
        const offAcross = ch * (across + gap * 2);
        for (let i = 0; i < segments; i++) {
            const along = i * (seg + gap);
            const on = (i + 1) / segments <= lit + 1e-9;
            const fill = on ? zoneColor(segDb(i), zones) : (o.off ?? "#23262b");
            parts.push(rect(horizontal, o.x, o.y, along, offAcross, seg, across, fill, o.length));
        }
        const peak = o.peaks?.[ch];
        if (peak !== undefined && peak > scale[0][0]) {
            const at = Math.min(o.length - 2, scalePosition(peak, scale) * o.length);
            parts.push(rect(horizontal, o.x, o.y, at, offAcross, 2, across, zoneColor(peak, zones), o.length));
        }
    });
    return parts;
}

/** Ticks and labels for a meter's scale, under a lying bar (`y` = top of the tick line). */
export function meterScaleMarks(x: number, y: number, length: number, ticks: readonly number[], opts: { scale?: ScalePoints; color?: string; size?: number } = {}): string[] {
    return ticks.map((d) => {
        const tx = (x + scalePosition(d, opts.scale ?? METER_SCALE) * length).toFixed(1);
        return `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y + 4}" stroke="${opts.color ?? "#666"}"/><text x="${tx}" y="${y + 13}" font-family="Arial,sans-serif" font-size="${opts.size ?? 8}" fill="${opts.color ?? "#888"}" text-anchor="middle">${d}</text>`;
    });
}

/** Inverse of scalePosition (dB at a position). */
function dbAt(p: number, scale: ScalePoints): number {
    for (let i = 1; i < scale.length; i++) {
        const [d1, p1] = scale[i - 1];
        const [d2, p2] = scale[i];
        if (p <= p2) return d1 + ((p - p1) / (p2 - p1)) * (d2 - d1);
    }
    return scale[scale.length - 1][0];
}

/** A rect in bar coordinates: `along` from the start (left or bottom), `across` from the top or left. */
function rect(horizontal: boolean, x: number, y: number, along: number, across: number, len: number, thick: number, fill: string, length: number): string {
    const r = Math.min(1.5, thick / 6).toFixed(1);
    return horizontal
        ? `<rect x="${(x + along).toFixed(1)}" y="${(y + across).toFixed(1)}" width="${len.toFixed(1)}" height="${thick.toFixed(1)}" rx="${r}" fill="${fill}"/>`
        : `<rect x="${(x + across).toFixed(1)}" y="${(y + length - along - len).toFixed(1)}" width="${thick.toFixed(1)}" height="${len.toFixed(1)}" rx="${r}" fill="${fill}"/>`;
}
