// The family's key look (taken from MA-C, so all plugins look alike), as building blocks for a
// plugin's own key renderer: the dark background, the large plain icon (112 px, 92 px with a
// caption), "on" as a tinted plate plus a rounded frame in the accent colour, the colour tiers, and
// the bold caption at the bottom. Keys are SVG at the @2x size (144 px).
import { escapeXml } from "./strip.js";
import { measureArialWidth, truncateToWidth } from "./text-width.js";

export const KEY_SIZE = 144;
export const KEY_BG = "#101010";

/**
 * Colour tiers, the same on every key: on/active = the plugin's accent (or the key's colour),
 * AVAILABLE = an action that can be used, OFF = a toggle that is off or a choice that isn't the
 * current one, UNAVAILABLE = can't be used right now (offline, nothing to do).
 */
export const KEY_TIERS = { available: "#e0e0e0", off: "#8a8a90", unavailable: "#4a4a50" } as const;

/** Icon placement: full size without text, smaller and higher with a caption under it. */
export const KEY_ICON = {
    full: { size: 112, x: 16, y: 16 },
    withCaption: { size: 92, x: 26, y: 6 },
} as const;

/** "On" (MA-C's active look), drawn under the icon: a tinted plate in the colour. */
export function keyActivePlate(color: string): string {
    return `<rect x="4" y="4" width="${KEY_SIZE - 8}" height="${KEY_SIZE - 8}" rx="18" fill="${escapeXml(color)}" opacity="0.14"/>`;
}

/** "On", drawn over everything: a rounded frame in the colour. */
export function keyActiveFrame(color: string): string {
    return `<rect x="4" y="4" width="${KEY_SIZE - 8}" height="${KEY_SIZE - 8}" rx="18" fill="none" stroke="${escapeXml(color)}" stroke-width="3" opacity="0.7"/>`;
}

/** An MDI path at a placement. */
export function keyIcon(path: string, place: { size: number; x: number; y: number }, color: string, opacity = 1): string {
    const s = place.size / 24;
    return `<path d="${escapeXml(path)}" fill="${escapeXml(color)}"${opacity < 1 ? ` opacity="${opacity}"` : ""} transform="translate(${place.x} ${place.y}) scale(${s.toFixed(4)})"/>`;
}

/**
 * The caption under the icon: bold, as large as fits (28 px down to 16 px), cut with "…" when even
 * that is too wide. `y` is the baseline (default near the bottom edge).
 */
export function keyCaption(text: string, color: string, opts: { y?: number; max?: number; min?: number } = {}): string {
    const width = KEY_SIZE - 12;
    const max = opts.max ?? 28;
    const min = opts.min ?? 16;
    let size = max;
    while (size > min && measureArialWidth(text, size, true) > width) size--;
    const shown = measureArialWidth(text, size, true) > width ? truncateToWidth(text, size, width, true) : text;
    return `<text x="${KEY_SIZE / 2}" y="${opts.y ?? KEY_SIZE - 8}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${escapeXml(color)}">${escapeXml(shown)}</text>`;
}

/** The key image: the background, then the parts, as an SVG data URI. */
export function keySvg(parts: string[], background = KEY_BG): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${KEY_SIZE}" height="${KEY_SIZE}" viewBox="0 0 ${KEY_SIZE} ${KEY_SIZE}"><rect width="${KEY_SIZE}" height="${KEY_SIZE}" fill="${background}"/>${parts.join("")}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
