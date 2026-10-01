// Colour conversions for the colour picker: hex ↔ RGB ↔ HSV. HSV is what the colour wheel shows
// (hue = angle, saturation = distance from the centre, value = the brightness slider).

export type Rgb = { r: number; g: number; b: number };
/** h 0–360, s and v 0–1. */
export type Hsv = { h: number; s: number; v: number };

/** "#f7a600", "F7A600", "#fa0" → "#F7A600"; undefined for anything else. */
export function normalizeHex(input: string | undefined): string | undefined {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input?.trim() ?? '');
    if (!m) return undefined;
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return `#${h.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb | undefined {
    const n = normalizeHex(hex);
    if (!n) return undefined;
    const v = parseInt(n.slice(1), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
    const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const d = max - Math.min(R, G, B);
    let h = 0;
    if (d) {
        if (max === R) h = ((G - B) / d) % 6;
        else if (max === G) h = (B - R) / d + 2;
        else h = (R - G) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hsvToHex(hsv: Hsv): string {
    return rgbToHex(hsvToRgb(hsv));
}

export function hexToHsv(hex: string): Hsv | undefined {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsv(rgb) : undefined;
}
