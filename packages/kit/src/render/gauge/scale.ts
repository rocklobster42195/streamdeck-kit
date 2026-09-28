// Meter scales: where a dB value sits on a meter (0..1), and which colour zone it is in.
// The default curve gives the top of the range more room, like mixer apps do.

/** [dB, position 0..1] points of a piecewise linear scale, ascending. */
export type ScalePoints = readonly (readonly [number, number])[];

/** dBFS meter scale from -60 to 0, with more room near the top. */
export const METER_SCALE: ScalePoints = [
    [-60, 0],
    [-40, 0.15],
    [-30, 0.3],
    [-20, 0.5],
    [-10, 0.72],
    [-6, 0.82],
    [-3, 0.9],
    [0, 1],
];

/** Labels worth printing under a meter on METER_SCALE. */
export const METER_TICKS = [-60, -30, -20, -10, -6, -3, 0] as const;

/** Position 0..1 of `db` on a scale; clamped at both ends. */
export function scalePosition(db: number, points: ScalePoints = METER_SCALE): number {
    if (!Number.isFinite(db) || db <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
        const [d1, p1] = points[i - 1];
        const [d2, p2] = points[i];
        if (db <= d2) return p1 + ((db - d1) / (d2 - d1)) * (p2 - p1);
    }
    return points[points.length - 1][1];
}

/** Colour zones: each applies from its `from` dB upwards; the first one also covers everything below. */
export type Zones = readonly { from: number; color: string }[];

/** Green, yellow from -18 dB, red from -6 dB. */
export const METER_ZONES: Zones = [
    { from: -Infinity, color: "#3ddc84" },
    { from: -18, color: "#f5c542" },
    { from: -6, color: "#ff4d4d" },
];

export function zoneColor(db: number, zones: Zones = METER_ZONES): string {
    let color = zones[0].color;
    for (const z of zones) if (db >= z.from) color = z.color;
    return color;
}
