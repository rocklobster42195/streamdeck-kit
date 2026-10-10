// The universal Track dial's picture (grill 2026-10-10): cover on one side (the user's choice),
// title, artist and progress beside it, all low; as "Equalizer" bars above them move while it plays
// (the text stays where it is, so nothing jumps when it pauses). Over a Panorama effect the text gets small dark boxes. SDK-free.
import { mdiMusicNote, mdiPlay } from '@mdi/js';
import { image, mdi, progressBar, scrimBox, stripImage, text, textWidth, wrap } from './strip.js';

export type TrackDialLook = 'info' | 'eq';

export type TrackDialView = {
    title?: string;
    artist?: string;
    /** The cover as an image URL a strip can show (data URI). */
    cover?: string;
    playing: boolean;
    /** 0..1; undefined: none (live radio or unknown length). */
    progress?: number;
    /** A live stream: "LIVE" instead of the progress. */
    live?: boolean;
    /** The progress bar's and the bars' colour. */
    accent: string;
    coverSide?: 'left' | 'right';
    look?: TrackDialLook;
    /** The title and artist as scrolling text (marqueeSvg), when the plugin runs the marquee; else plain. */
    titleSvg?: string;
    artistSvg?: string;
    /** Bar heights (px, up to 18) for the Equalizer look while it plays. */
    bars?: number[];
    /** 0..1: bars shrink in the last seconds of a track. */
    amplitude?: number;
    /** A small round source or battery badge drawn on the cover's corner. */
    badge?: string;
    /** What the effect draws behind the dial (a Panorama slice). */
    underlay?: string;
    /** The text when nothing plays. */
    nothing: string;
    showTitle?: boolean;
};

const COVER = 100;
const MARGIN = 8;
const GAP = 8;
const TEXT_W = 200 - COVER - GAP - MARGIN;

export function renderTrackDial(v: TrackDialView): string {
    const side = v.coverSide ?? 'right';
    const coverX = side === 'right' ? 200 - COVER : 0;
    const tx = side === 'right' ? MARGIN : COVER + GAP;
    const eq = (v.look ?? 'info') === 'eq';
    const dim = v.playing ? 1 : 0.6;
    const parts: string[] = [];
    let scrim = '';

    // Cover (dimmed with a play symbol while it doesn't play)
    if (v.cover) parts.push(image(v.cover, coverX, 0, COVER, 100));
    else parts.push(`<rect x="${coverX}" width="${COVER}" height="100" fill="#1d1d20"/>`, mdi(mdiMusicNote, coverX + 26, 26, 48, "#5a5a60"));
    if (!v.playing && (v.title || v.artist)) parts.push(`<rect x="${coverX}" width="${COVER}" height="100" fill="#000" opacity="0.45"/>`, mdi(mdiPlay, coverX + 30, 30, 40, "#ffffff"));
    if (v.badge) parts.push(v.badge);

    if (!v.title && !v.artist) {
        wrap(v.nothing, TEXT_W, 13, 2).forEach((line, i) => parts.push(text(tx, 50 + i * 16, line, { size: 13, color: "#a4a4aa" })));
        return stripImage(parts, undefined, v.underlay ? v.underlay : undefined);
    }

    const title = v.title ?? "";
    const artist = v.artist ?? "";
    const showTitle = v.showTitle !== false && !!title;
    // The text sits low in both looks: title 72, artist 86, progress 95; the bars rise from y 56
    const titleY = 72;
    const artistY = 86;
    const barY = 95;
    const group: string[] = [];
    if (showTitle) group.push(v.titleSvg ?? text(tx, titleY, title, { size: 14, maxWidth: TEXT_W }));
    if (artist) group.push(v.artistSvg ?? text(tx, artistY, artist, { size: 11, color: "#999999", maxWidth: TEXT_W }));
    parts.push(`<g opacity="${dim}">${group.join("")}</g>`);
    if (v.underlay) {
        const tw = (s: string, size: number) => Math.min(TEXT_W + 6, textWidth(s, size) + 8);
        if (showTitle) scrim += scrimBox(tx - 4, titleY - 14, tw(title, 14), 19);
        if (artist) scrim += scrimBox(tx - 4, artistY - 11, tw(artist, 11), 15);
    }

    // Progress, or LIVE
    if (v.live) {
        // Small, in the bar's place (the artist line sits right above it)
        const ly = 88;
        parts.push(`<rect x="${tx}" y="${ly}" width="30" height="11" rx="3" fill="${v.accent}"/>`, text(tx + 15, ly + 8.5, "LIVE", { size: 9, weight: "bold", color: "#0b0b0c", anchor: "middle" }));
    } else if (v.progress !== undefined) {
        parts.push(...progressBar(tx, barY, TEXT_W, v.progress, v.accent, 5));
    }

    // Equalizer bars
    if (eq && v.playing && v.bars) {
        const amp = v.amplitude ?? 1;
        // Over an effect the bars get a dark box too, so they stay readable
        if (v.underlay) scrim += scrimBox(tx - 4, 34, v.bars.length * 9 + 1, 26);
        v.bars.forEach((h, i) => {
            const rh = Math.max(1, Math.round(h * amp));
            parts.push(`<rect x="${tx + i * 9}" y="${56 - rh}" width="7" height="${rh}" fill="${v.accent}" opacity="${(0.75 * amp).toFixed(2)}" rx="1"/>`);
        });
    }
    return stripImage(parts, undefined, v.underlay ? v.underlay + scrim : undefined);
}
