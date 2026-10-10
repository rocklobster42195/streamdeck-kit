// The picture of the universal Play/Pause key (grill 2026-10-09): sonos-controller's key as the
// base — the cover while it plays, the cover dimmed with a play symbol while paused, a scrolling
// title and a progress pill at the bottom — plus two corners the user fills (see corners.ts).
import { mdiMusicNote, mdiPlay, mdiTimerSand } from '@mdi/js';
import { KEY_BG, KEY_SIZE, KEY_TIERS, keySvg } from '../render/key-style.js';
import { cornerSvg, type CornerBadge } from './corners.js';

import { keyLoadingOverlay, keyStatusBadge, type StatusKind } from '../render/status-badge.js';

export type PlayPauseView = {
    /** No player to control (none chosen, gone, plugin away): a dimmed play symbol. */
    unavailable?: boolean;
    playing: boolean;
    /** How far the paused look (dimmed cover, play symbol) is in, 0..1, while it fades; default by `playing`. */
    dim?: number;
    /** Waiting for the device (starting). */
    loading?: boolean;
    /** The cover as a data: URI; with `previousCover` and `coverMix` while two crossfade. */
    cover?: string;
    previousCover?: string;
    coverMix?: number;
    /** Icon colour without a cover (the key colour). */
    iconColor: string;
    /** The play symbol on a paused cover and the progress fill (the cover's colour or the key colour). */
    accent: string;
    /** 0..1, or undefined for none (no duration: radio, a stream). */
    progress?: number;
    /** The scrolling title, as an SVG fragment (TitleFader.svg()). */
    titleSvg?: string;
    left?: CornerBadge;
    right?: CornerBadge;
    /** What the player is doing about a command (a corner badge). */
    status?: StatusKind;
};

const S = KEY_SIZE;

/** The key as an SVG data URI (144 × 144). */
export function renderPlayPauseKey(v: PlayPauseView): string {
    const parts: string[] = [];
    // Waiting for the device: this key's own hourglass, or the player's (a command taking a while)
    const loading = v.loading || v.status === 'loading';
    if (v.unavailable) {
        parts.push(icon(mdiPlay, 36, 36, 72, KEY_TIERS.unavailable));
    } else if (v.cover) {
        const mix = v.previousCover ? Math.min(1, Math.max(0, v.coverMix ?? 1)) : 1;
        if (mix < 1) parts.push(`<image href="${v.previousCover}" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice"/>`);
        parts.push(`<image href="${v.cover}" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice"${mix < 1 ? ` opacity="${mix.toFixed(2)}"` : ''}/>`);
        const dim = Math.min(1, Math.max(0, v.dim ?? (v.playing ? 0 : 1)));
        if (dim > 0) {
            // Paused: the cover stays, dimmed, with a play symbol (press to resume); fades in and out
            const shade = (0.55 * dim).toFixed(2);
            parts.push(`<rect width="${S}" height="${S}" fill="#000" opacity="${shade}"/>`, `<circle cx="72" cy="72" r="30" fill="#000" opacity="${shade}"/>`);
            parts.push(icon(loading ? mdiTimerSand : mdiPlay, 48, 48, 48, v.accent, dim));
        } else if (v.status === 'loading') {
            parts.push(keyLoadingOverlay());
        }
    } else {
        parts.push(icon(loading ? mdiTimerSand : v.playing ? mdiMusicNote : mdiPlay, 36, 36, 72, v.iconColor));
    }
    if (v.titleSvg && !v.unavailable) parts.push(v.titleSvg);
    if (v.progress !== undefined && !v.unavailable) parts.push(progressPill(v.progress, v.accent));
    parts.push(cornerSvg(v.left, 'left'), cornerSvg(v.right, 'right'));
    if (v.status === 'failed' && !v.unavailable) parts.push(keyStatusBadge(v.status));
    return keySvg(parts, KEY_BG);
}

/**
 * sonos-controller's progress bar at 144 px: a thin rounded bar below the title band, on its own
 * dark pill (covers are unpredictable), the fill brightened enough to read at this height.
 */
export function progressPill(progress: number, color: string): string {
    const margin = 6;
    const height = 6;
    const y = 134;
    const width = S - margin * 2;
    const fill = Math.round(width * Math.min(1, Math.max(0, progress)));
    const pad = 2;
    return [
        `<rect x="${margin - pad}" y="${y - pad}" width="${width + pad * 2}" height="${height + pad * 2}" rx="${(height + pad * 2) / 2}" fill="#000000" fill-opacity="0.55"/>`,
        `<rect x="${margin}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="#ffffff" fill-opacity="0.3"/>`,
        fill > 0 ? `<rect x="${margin}" y="${y}" width="${fill}" height="${height}" rx="${height / 2}" fill="${readableBar(color)}"/>` : '',
    ].join('');
}

/** A colour light enough for a 6 px bar on a dark pill (luminance at least 0.62, hue kept). */
export function readableBar(color: string): string {
    const rgb = parseColor(color);
    if (!rgb) return '#e6e6e6';
    const [r, g, b] = rgb;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const target = 0.62;
    if (lum >= target) return color;
    const f = (target - lum) / (1 - lum);
    const mix = (v: number) => Math.round(v + (255 - v) * f);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function parseColor(c: string): [number, number, number] | undefined {
    const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (hex) {
        const v = parseInt(hex[1], 16);
        return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
    }
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c);
    return m ? [+m[1], +m[2], +m[3]] : undefined;
}

function icon(path: string, x: number, y: number, size: number, fill: string, opacity = 1): string {
    return `<path transform="translate(${x} ${y}) scale(${size / 24})" fill="${fill}"${opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : ''} d="${path}"/>`;
}
