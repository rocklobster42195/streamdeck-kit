// Analog VU meter ("classic"): cream face in a dark bezel, arc scale -20..+3 VU with a red zone
// above 0, black needle. Feed the needle through VuBallistics for the typical inertia.

/** VU scale positions 0..1 (the classic printed scale, not linear). */
const VU_POINTS: readonly (readonly [number, number])[] = [
    [-20, 0], [-10, 0.2], [-7, 0.3], [-5, 0.4], [-3, 0.54], [-2, 0.61], [-1, 0.69], [0, 0.77], [1, 0.85], [2, 0.92], [3, 1],
];
const LABELS = [-20, -10, -5, -3, 0, 3];

/** VU for a dBFS level, with 0 VU at `referenceDbfs` (studio standard -18). */
export function dbfsToVu(dbfs: number, referenceDbfs = -18): number {
    return dbfs - referenceDbfs;
}

export function vuPosition(vu: number): number {
    if (!Number.isFinite(vu) || vu <= -20) return 0;
    if (vu >= 3) return 1;
    for (let i = 1; i < VU_POINTS.length; i++) {
        const [v1, p1] = VU_POINTS[i - 1];
        const [v2, p2] = VU_POINTS[i];
        if (vu <= v2) return p1 + ((vu - v1) / (v2 - v1)) * (p2 - p1);
    }
    return 1;
}

export type VuMeterOptions = {
    /** Face rectangle (bezel included). */
    x: number;
    y: number;
    width: number;
    height: number;
    /** Needle position in VU (from VuBallistics). */
    vu: number;
    /** Small caption on the face, e.g. "LEFT", "MONO". */
    label?: string;
    /** Unique prefix for the gradient ids when several meters share one SVG. */
    id?: string;
};

export function vuMeter(o: VuMeterOptions): string[] {
    const id = o.id ?? "vu";
    const cx = o.x + o.width / 2;
    const cy = o.y + o.height - 6;
    const r = Math.min(o.width * 0.42, o.height * 0.62);
    const small = r < 50;
    const a0 = -48;
    const a1 = 48;
    const ang = (p: number) => ((a0 + p * (a1 - a0)) * Math.PI) / 180;
    const pt = (p: number, rr: number) => [cx + rr * Math.sin(ang(p)), cy - rr * Math.cos(ang(p))];
    const arc = (p1: number, p2: number, rr: number) => {
        const [x1, y1] = pt(p1, rr);
        const [x2, y2] = pt(p2, rr);
        return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rr} ${rr} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };
    const font = `font-family="Arial,sans-serif"`;
    const parts = [
        `<defs><radialGradient id="${id}-face" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="#fbf1cf"/><stop offset="1" stop-color="#e6cf8f"/></radialGradient><linearGradient id="${id}-bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555"/><stop offset="1" stop-color="#1b1b1b"/></linearGradient></defs>`,
        `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="8" fill="url(#${id}-bezel)"/>`,
        `<rect x="${o.x + 3}" y="${o.y + 3}" width="${o.width - 6}" height="${o.height - 6}" rx="6" fill="url(#${id}-face)"/>`,
        `<path d="${arc(0, vuPosition(0), r)}" stroke="#222" stroke-width="1.5" fill="none"/>`,
        `<path d="${arc(vuPosition(0), 1, r)}" stroke="#c0271f" stroke-width="${small ? 3 : 4}" fill="none"/>`,
    ];
    for (const [v, p] of VU_POINTS) {
        const [x1, y1] = pt(p, r);
        const [x2, y2] = pt(p, r + (small ? 5 : 6));
        const c = v > 0 ? "#c0271f" : "#222";
        parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}"/>`);
        if (LABELS.includes(v)) {
            const [tx, ty] = pt(p, r + (small ? 12 : 13));
            parts.push(`<text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" ${font} font-size="7" fill="${c}" text-anchor="middle">${v > 0 ? `+${v}` : v}</text>`);
        }
    }
    parts.push(`<text x="${cx}" y="${(cy - r * 0.35).toFixed(1)}" ${font} font-size="${small ? 10 : 11}" font-weight="bold" font-style="italic" fill="#222" text-anchor="middle">VU</text>`);
    if (o.label) parts.push(`<text x="${cx}" y="${(cy - r * 0.12).toFixed(1)}" ${font} font-size="7.5" fill="#555" text-anchor="middle">${o.label}</text>`);
    const [nx, ny] = pt(vuPosition(o.vu), r + 7);
    parts.push(`<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>`, `<circle cx="${cx}" cy="${cy}" r="4" fill="#111"/>`);
    return parts;
}
