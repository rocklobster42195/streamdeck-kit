// Ring gauge: a track circle and a round-capped arc from 12 o'clock clockwise. MA-C's volume ring
// on keys and dials.

export type ArcOptions = {
    /** Track color behind the arc. */
    track?: string;
    /** Stroke width of track and arc. */
    width?: number;
};

/** SVG parts of a ring gauge (value 0..1) centered at (cx, cy). */
export function arc(cx: number, cy: number, r: number, value: number, color: string, opts: ArcOptions = {}): string[] {
    const width = opts.width ?? 8;
    const v = clamp01(value);
    const circumference = 2 * Math.PI * r;
    const parts = [`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${opts.track ?? "#2c2c30"}" stroke-width="${width}"/>`];
    if (v > 0) {
        parts.push(
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${(v * circumference).toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`,
        );
    }
    return parts;
}

export function clamp01(v: number): number {
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
