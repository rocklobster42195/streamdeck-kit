// The family's key look (taken from MA-C, so all plugins look alike), as building blocks for a
// plugin's own key renderer: the dark background, the large plain icon (112 px, 92 px with a
// caption), "on" as a tinted plate plus a rounded frame in the accent colour, the colour tiers, and
// the bold caption at the bottom. Keys are SVG at the @2x size (144 px).
import { escapeXml, textWidth, wrap } from "./strip.js";
import { measureArialWidth, truncateToWidth } from "./text-width.js";

export const KEY_SIZE = 144;
export const KEY_BG = "#101010";

/**
 * Colour tiers, the same on every key: on/active = the plugin's accent (or the key's colour),
 * AVAILABLE = an action that can be used, OFF = a toggle that is off or a choice that isn't the
 * current one, UNAVAILABLE = can't be used right now (offline, nothing to do).
 */
export const KEY_TIERS = { available: "#e0e0e0", off: "#8a8a90", unavailable: "#4a4a50" } as const;

/**
 * The one symbol size of a key, straight on the key or the dimmed cover: no disc, no fade. 96 px of the 144,
 * the "Variante A" of the mock-up the family agreed on (alpha.36 had drawn 72 px, which looked clearly smaller).
 */
export const KEY_GLYPH = { size: 96, x: 24, y: 24 } as const;

/**
 * Icon placement. `full` is the one symbol size; `withCaption` a little smaller with the caption close
 * under it (one group, as in the mock-up); `compact` is smaller, for a caption plus another row under it
 * (a level bar, a message); `twoLines` is smaller and higher, for two lines of text (name + value, or a
 * wrapped name).
 */
export const KEY_ICON = {
    full: KEY_GLYPH,
    withCaption: { size: 80, x: 32, y: 10 },
    compact: { size: 60, x: 42, y: 20 },
    twoLines: { size: 60, x: 42, y: 6 },
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
 * The caption under the icon: bold, as large as fits (24 px down to 16 px), cut with "…" when even
 * that is too wide, kept clear of the "on" frame. `y` is the baseline (default near the bottom).
 */
export function keyCaption(text: string, color: string, opts: { y?: number; max?: number; min?: number } = {}): string {
    // Inside the "on" frame (4 px inset, 3 px stroke) with a little air
    const width = KEY_SIZE - 24;
    const max = opts.max ?? 24;
    const min = opts.min ?? 16;
    let size = max;
    while (size > min && measureArialWidth(text, size, true) > width) size--;
    const shown = measureArialWidth(text, size, true) > width ? truncateToWidth(text, size, width, true) : text;
    return `<text x="${KEY_SIZE / 2}" y="${opts.y ?? KEY_SIZE - 16}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${escapeXml(color)}">${escapeXml(shown)}</text>`;
}

/**
 * A key's name and where its icon goes. A name that fits on one line (16 px or larger) sits under the
 * icon, which has the one symbol size. A longer name with a space breaks onto two lines (20 px down to
 * 14 px, the second line cut with "…" if it still doesn't fit) and the icon is smaller and higher, as with
 * name + value. A long word without a space stays on one line, down to 13 px, then cut.
 */
export function keyLabel(text: string, color: string): { place: { size: number; x: number; y: number }; svg: string } {
    const width = KEY_SIZE - 24;
    const name = text.trim();
    if (textWidth(name, 16, { bold: true }) <= width || !name.includes(" ")) {
        return { place: KEY_ICON.withCaption, svg: keyCaption(name, color, { min: 13 }) };
    }
    let size = 20;
    let lines = wrap(name, width, size, 2);
    while (size > 14 && lines.join(" ") !== name) lines = wrap(name, width, --size, 2);
    if (lines.length === 1) return { place: KEY_ICON.withCaption, svg: keyCaption(name, color, { min: 13 }) };
    const svg = lines.map((line, i) => keyCaption(line, color, { y: 100 + i * 26, max: size, min: size })).join("");
    return { place: KEY_ICON.twoLines, svg };
}

/** The key image: the background, then the parts, as an SVG data URI. */
export function keySvg(parts: string[], background = KEY_BG): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${KEY_SIZE}" height="${KEY_SIZE}" viewBox="0 0 ${KEY_SIZE} ${KEY_SIZE}"><rect width="${KEY_SIZE}" height="${KEY_SIZE}" fill="${background}"/>${parts.join("")}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
