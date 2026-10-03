// Touch-strip layout of a dial list (pure: data in, SVG data URI out): equal rows stacked
// vertically, the row nearest the centre marked, neighbours cut off and dimmed.
//
// Row: picture (cover, MDI icon or none) on the left, title + second line on the right — or a
// two-line title when there is no second line. The active row (e.g. what is playing) has its title
// in the accent colour and a small icon on the right; folders show a chevron there.
import { mdiChevronRight, mdiWaveform } from '@mdi/js';
import { marqueeSvg } from '../render/marquee.js';
import { escapeXml, image, mdi, stripImage, text, wrap } from '../render/strip.js';

export type ListRow = {
    title: string;
    subtitle?: string;
    /** Cover as a data URI (or any href the Stream Deck can draw). */
    image?: string;
    /** MDI path, drawn when there is no image (or images are off). */
    icon?: string;
    iconColor?: string;
    active?: boolean;
    folder?: boolean;
};

export type ListStripView = {
    count: number;
    /** Rows are asked for only around the centre (load covers there). */
    row: (index: number) => ListRow | undefined;
    /** Fractional row at the centre. */
    position: number;
    marked: number;
    accent: string;
    /** Icon of the active row (MDI path); default: a waveform. */
    activeIcon?: string;
    /** false: icons only, no covers. */
    showImages?: boolean;
    /** Panorama slice drawn under the list. */
    backdrop?: string;
    /** Marker crossfade: 0..1 for the marked row, the rest for `previousMarked`. */
    markerAlpha?: number;
    previousMarked?: number;
    /** Short overlay at the top (e.g. the breadcrumb after changing level). */
    overlay?: { text: string; alpha: number };
    /** Scroll the marked row's title when it doesn't fit; `offset` from a MarqueeStepper. */
    marquee?: { id: string; offset: number };
    /** Instead of rows: placeholders while loading, or one sentence (empty, error). */
    state?: 'loading' | { message: string };
};

export const LIST_ROW_H = 40;
const COVER = 32;
const DIM = 0.5;
/** Same pace as the track dials' titles (40 px/s read as too fast on hardware, 2026-10-03). */
export const LIST_MARQUEE_SPEED = 25;
export const LIST_MARQUEE_PAUSE_MS = 1500;

/** Title width available in a row (for deciding whether it needs a marquee). */
export function listTitleWidth(row: ListRow, showImages = true): number {
    const left = hasPicture(row, showImages) ? 48 : 10;
    return (row.active || row.folder ? 166 : 188) - left;
}

export function listStrip(v: ListStripView): string {
    const parts: string[] = [];
    if (v.state === 'loading') {
        for (let i = -1; i <= 1; i++) parts.push(placeholder(50 - LIST_ROW_H / 2 + i * LIST_ROW_H, i === 0));
    } else if (v.state) {
        parts.push(text(100, 55, v.state.message, { size: 13, color: '#a4a4aa', anchor: 'middle', maxWidth: 184 }));
    } else {
        const first = Math.max(0, Math.floor(v.position) - 2);
        const last = Math.min(v.count - 1, Math.ceil(v.position) + 2);
        for (let i = first; i <= last; i++) {
            const top = 50 - LIST_ROW_H / 2 + (i - v.position) * LIST_ROW_H;
            // Asked for even when just outside, so the plugin prefetches their covers
            const r = v.row(i);
            if (r && top > -LIST_ROW_H && top < 100) parts.push(row(v, r, i, top));
        }
        parts.push(...scrollbar(v.count, v.position));
    }
    if (v.overlay && v.overlay.alpha > 0) {
        parts.push(
            `<g opacity="${v.overlay.alpha.toFixed(2)}"><rect width="200" height="17" fill="#0a0a0a" fill-opacity="0.85"/>`,
            text(8, 12, v.overlay.text, { size: 10, color: '#a4a4aa', maxWidth: 184 }),
            '</g>',
        );
    }
    return stripImage(parts, undefined, v.backdrop);
}

function row(v: ListStripView, r: ListRow, i: number, top: number): string {
    const p: string[] = [];
    const alpha = v.markerAlpha ?? 1;
    const markOpacity = i === v.marked ? alpha : i === v.previousMarked ? 1 - alpha : 0;
    if (markOpacity > 0) p.push(`<rect x="3" y="${(top + 1).toFixed(1)}" width="190" height="${LIST_ROW_H - 2}" rx="7" fill="#ffffff" fill-opacity="${(0.13 * markOpacity).toFixed(3)}"/>`);

    const showImages = v.showImages ?? true;
    const cy = top + (LIST_ROW_H - COVER) / 2;
    if (showImages && r.image) p.push(image(r.image, 8, cy, COVER, COVER));
    else if (r.icon) p.push(`<rect x="8" y="${cy.toFixed(1)}" width="${COVER}" height="${COVER}" rx="5" fill="#1d1d20"/>`, mdi(r.icon, 14, cy + 6, 20, r.iconColor ?? (r.folder ? v.accent : '#8a8a90')));

    const x = hasPicture(r, showImages) ? 48 : 10;
    const width = listTitleWidth(r, showImages);
    const color = r.active ? v.accent : '#ffffff';
    if (r.subtitle) {
        const baseline = top + 18;
        if (i === v.marked && v.marquee) {
            p.push(marqueeSvg({ id: `${v.marquee.id}-${i}`, text: r.title, x, y: baseline, width, fontSize: 13, weight: 'bold', color, startedAt: 0, now: 0, offset: v.marquee.offset }));
        } else {
            p.push(text(x, baseline, r.title, { size: 13, weight: 'bold', color, maxWidth: width }));
        }
        p.push(text(x, top + 33, r.subtitle, { size: 11, color: '#a4a4aa', maxWidth: width }));
    } else {
        const lines = wrap(r.title, width, 13, 2);
        const y0 = lines.length > 1 ? top + 17 : top + 25;
        lines.forEach((line, n) => p.push(`<text x="${x}" y="${(y0 + n * 15).toFixed(1)}" fill="${color}" font-family="Arial,sans-serif" font-size="13" font-weight="bold">${escapeXml(line)}</text>`));
    }
    if (r.active) p.push(mdi(v.activeIcon ?? mdiWaveform, 172, top + 11, 18, v.accent));
    else if (r.folder) p.push(mdi(mdiChevronRight, 172, top + 11, 18, '#8a8a90'));
    return `<g opacity="${i === v.marked ? 1 : DIM}">${p.join('')}</g>`;
}

function hasPicture(r: ListRow, showImages: boolean): boolean {
    return !!((showImages && r.image) || r.icon);
}

function placeholder(top: number, centre: boolean): string {
    const cy = top + (LIST_ROW_H - COVER) / 2;
    return `<g opacity="${centre ? 1 : DIM}"><rect x="8" y="${cy}" width="${COVER}" height="${COVER}" rx="5" fill="#1d1d20"/><rect x="48" y="${top + 10}" width="110" height="9" rx="4" fill="#2c2c30"/><rect x="48" y="${top + 25}" width="70" height="7" rx="3" fill="#232326"/></g>`;
}

function scrollbar(count: number, position: number): string[] {
    if (count < 2) return [];
    const h = Math.max(8, 92 / count);
    const p = Math.min(count - 1, Math.max(0, position));
    const y = 4 + ((92 - h) * p) / (count - 1);
    return [`<rect x="197" y="4" width="2" height="92" rx="1" fill="#2c2c30"/>`, `<rect x="197" y="${y.toFixed(1)}" width="2" height="${h.toFixed(1)}" rx="1" fill="#8a8a90"/>`];
}
