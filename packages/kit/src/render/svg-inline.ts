// An SVG picture (a data: URI, e.g. a music service's logo) drawn inside a key image. Stream Deck's
// renderer draws nothing for a nested <svg> and doesn't load an SVG through <image>, so the
// picture goes in as a plain group, scaled into its box. From MA-C's provider logos (2026-09-30).

type Parsed = { viewBox: [number, number, number, number]; attrs: string; inner: string };

const cache = new Map<string, Parsed | null>();

// Editor leftovers (Inkscape/Sodipodi): their namespaces are declared on the root we drop
const EDITOR_ELEMENTS = /<(sodipodi|inkscape):[a-zA-Z]+[\s\S]*?(\/>|<\/(sodipodi|inkscape):[a-zA-Z]+>)/g;
const EDITOR_ATTRS = /\s(sodipodi|inkscape):[a-zA-Z-]+="[^"]*"/g;

/** Whether a picture is an SVG data URI (drawn with svgGroup) rather than a raster one. */
export function isSvgDataUri(href: string): boolean {
    return /^data:image\/svg\+xml[;,]/.test(href);
}

/** Split a data-URI SVG into its viewBox, the root's paint attributes and its content; null when it isn't one. */
export function parseSvgDataUri(dataUri: string): Parsed | null {
    const hit = cache.get(dataUri);
    if (hit !== undefined) return hit;
    const parsed = parse(dataUri);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    cache.set(dataUri, parsed);
    return parsed;
}

function parse(dataUri: string): Parsed | null {
    const match = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(dataUri);
    if (!match) return null;
    const svg = (match[1] ? Buffer.from(match[2], 'base64').toString('utf8') : decodeURIComponent(match[2]))
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
        .replace(EDITOR_ELEMENTS, '')
        .replace(EDITOR_ATTRS, '');
    const root = /<svg([^>]*)>([\s\S]*)<\/svg>/.exec(svg);
    if (!root) return null;
    const rootAttrs = root[1];
    const vb = /viewBox="([^"]+)"/.exec(rootAttrs)?.[1].trim().split(/[\s,]+/).map(Number);
    const w = Number(/\swidth="([\d.]+)/.exec(rootAttrs)?.[1] ?? 0);
    const h = Number(/\sheight="([\d.]+)/.exec(rootAttrs)?.[1] ?? 0);
    const viewBox = (vb && vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, w || 24, h || 24]) as Parsed['viewBox'];
    // Keep only what paints: fill/stroke settings and a style
    const attrs = [...rootAttrs.matchAll(/\s(fill|fill-rule|clip-rule|stroke|style)="[^"]*"/g)].map((m) => m[0]).join('');
    return { viewBox, attrs, inner: root[2] };
}

/**
 * The SVG picture as a group fitted into the box at (x, y), size × size; '' when it can't be read.
 * `color` paints a one-colour logo in that colour (every fill and stroke but "none").
 */
export function svgGroup(dataUri: string, x: number, y: number, size: number, color?: string): string {
    const parsed = parseSvgDataUri(dataUri);
    if (!parsed) return '';
    const p = color ? recolor(parsed, color) : parsed;
    const [vx, vy, vw, vh] = p.viewBox;
    const scale = size / Math.max(vw, vh);
    const dx = x + (size - vw * scale) / 2;
    const dy = y + (size - vh * scale) / 2;
    return `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-vx} ${-vy})"${p.attrs}>${p.inner}</g>`;
}

function recolor(p: Parsed, color: string): Parsed {
    const paint = (s: string) =>
        s
            .replace(/\b(fill|stroke)="(?!none)[^"]*"/g, `$1="${color}"`)
            .replace(/\b(fill|stroke)\s*:\s*(?!none)[^;"]+/g, `$1:${color}`);
    // A logo without any fill of its own is black by default: give the group the colour
    const attrs = /\bfill=/.test(p.attrs) ? paint(p.attrs) : `${paint(p.attrs)} fill="${color}"`;
    return { ...p, attrs, inner: paint(p.inner) };
}
