// Text over the panorama effect: "title & artist" (ported from sonos-controller's
// PanoramaEffectsDial overlay) or synced lyrics, now in the kit so every plugin draws the same text
// (a run can span dials of several plugins: panorama/text-run.ts). Neighbouring text dials form one "run": text is
// laid out across the whole run and every display draws its own 200 px window of it.
import { balanceLines, measureArialWidth, wrapToWidth } from "./text-width.js";
import { escapeXml, fit } from "./strip.js";

/** A run of neighbouring text dials: total width, and where this display sits in it. */
export type TextRun = { width: number; offset: number };

export const FADE_MS = 400;

/** 0 → 1 over FADE_MS after `changedAt`. */
export function fadeProgress(changedAt: number, now = Date.now()): number {
    return Math.min(1, Math.max(0, (now - changedAt) / FADE_MS));
}

type TrackInfo = { title: string; artist: string };

/**
 * Title and artist right-aligned at the end of the run on dark pills (as in sonos-controller).
 * While `t` < 1 the previous text dissolves into the new one.
 */
export function trackOverlay(run: TextRun, info: TrackInfo, prev?: TrackInfo, t = 1): string {
    const x = run.width - 4;
    const max = run.width - 12;
    const layers = [{ info, opacity: t }, ...(prev && t < 1 ? [{ info: prev, opacity: 1 - t }] : [])];
    const shown = layers.map((l) => ({ ...l, title: fit(l.info.title, max, 20), artist: fit(l.info.artist, max, 15) }));
    const titleW = Math.max(...shown.map((s) => (s.title ? measureArialWidth(s.title, 20) : 0)));
    const artistW = Math.max(...shown.map((s) => (s.artist ? measureArialWidth(s.artist, 15) : 0)));
    const parts: string[] = [];
    if (titleW) parts.push(`<rect x="${x - titleW - 4}" y="49" width="${titleW + 8}" height="27" rx="3" fill="#000" fill-opacity="0.7"/>`);
    if (artistW) parts.push(`<rect x="${x - artistW - 4}" y="77" width="${artistW + 8}" height="20" rx="3" fill="#000" fill-opacity="0.7"/>`);
    for (const s of shown) {
        parts.push(label(x, 72, s.title, 20, "#ffffff", "500", "end", s.opacity), label(x, 93, s.artist, 15, "#aaaaaa", "normal", "end", s.opacity));
    }
    return inRun(run, parts);
}

const SUNG = 22;
const NEXT = 16;
const NEXT_COLOR = "#d4d4d8";

/**
 * The sung line (large; long lines are split into even halves at full size) and the next one
 * (smaller, a little dimmer), centered across the run. While `t` < 1 the previous line fades out
 * and the new one slides in. An empty line (instrumental gap, before the first line) shows a note.
 */
export function lyricsOverlay(run: TextRun, current: string, next: string, previous: string | undefined, t = 1): string {
    const cx = run.width / 2;
    // 16 px margin on each side, so lines never touch the edges of the run
    const max = run.width - 32;
    const layout = sungLayout(current, max);
    const parts: string[] = [];
    if (previous !== undefined && t < 1) parts.push(...sungLines(cx, sungLayout(previous, max), 1 - t, -6 * t));
    parts.push(...sungLines(cx, layout, t, 8 * (1 - t)));
    // The next line sits below the sung block (left out when the sung line needs three rows)
    if (next && layout.lines.length < 3) parts.push(backed(cx, layout.lines.length > 1 ? 90 : 82, fit(next, max, NEXT), NEXT, NEXT_COLOR, "normal", 1));
    return inRun(run, parts);
}

/**
 * Lyrics timing while the dial turns: a scale across the top of the run with a tick at 0 and a
 * marker at the current offset, plus its value ("+0.7 s").
 */
export function timingOverlay(run: TextRun, offset: number, min: number, max: number, opacity = 1): string {
    if (opacity <= 0) return "";
    const x0 = 16;
    const x1 = run.width - 16;
    const at = (v: number) => x0 + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (x1 - x0);
    const zero = at(0);
    const pos = at(offset);
    const value = `${offset > 0 ? "+" : offset < 0 ? "−" : "±"}${Math.abs(offset).toFixed(1)} s`;
    // A flat strip (the sung line right below stays readable): value next to the marker
    const w = measureArialWidth(value, 12, true);
    const right = pos + 8 + w <= x1;
    const o = opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : "";
    return inRun(run, [
        `<g${o}>`,
        `<rect x="${x0 - 8}" y="0" width="${x1 - x0 + 16}" height="19" rx="6" fill="#000" opacity="0.65"/>`,
        `<line x1="${x0}" y1="9.5" x2="${x1}" y2="9.5" stroke="#8a8a90" stroke-width="2"/>`,
        `<line x1="${zero.toFixed(1)}" y1="4" x2="${zero.toFixed(1)}" y2="15" stroke="#d4d4d8" stroke-width="2"/>`,
        `<line x1="${pos.toFixed(1)}" y1="2" x2="${pos.toFixed(1)}" y2="17" stroke="#6cc4ff" stroke-width="4" stroke-linecap="round"/>`,
        `<rect x="${(right ? pos + 5 : pos - 11 - w).toFixed(1)}" y="2" width="${(w + 6).toFixed(1)}" height="15" rx="4" fill="#000"/>`,
        label(right ? pos + 8 : pos - 8, 14, value, 12, "#ffffff", "bold", right ? "start" : "end", 1),
        `</g>`,
    ]);
}

/**
 * Which value the dial changes right now: a small pill at the top of the run with the function's
 * icon and name, plus a level bar (0–100) for effect values.
 */
export function functionOverlay(run: TextRun, icon: string, name: string, level: number | undefined, opacity = 1): string {
    if (opacity <= 0) return "";
    const textW = measureArialWidth(name, 12, true);
    const barW = level === undefined ? 0 : 44;
    const w = 8 + 16 + 6 + textW + (barW ? 8 + barW : 0) + 10;
    const x = run.width / 2 - w / 2;
    const o = opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : "";
    const parts = [
        `<g${o}>`,
        `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="22" rx="8" fill="#000" opacity="0.7"/>`,
        `<path transform="translate(${(x + 8).toFixed(1)} 3) scale(${16 / 24})" fill="#6cc4ff" d="${icon}"/>`,
        label(x + 30, 15.5, name, 12, "#ffffff", "bold", "start", 1),
    ];
    if (level !== undefined) {
        const bx = x + 30 + textW + 8;
        const v = Math.min(100, Math.max(0, level)) / 100;
        parts.push(`<rect x="${bx.toFixed(1)}" y="9" width="${barW}" height="4" rx="2" fill="#3a3a40"/>`, `<rect x="${bx.toFixed(1)}" y="9" width="${Math.max(4, barW * v).toFixed(1)}" height="4" rx="2" fill="#6cc4ff"/>`);
    }
    parts.push(`</g>`);
    return inRun(run, parts);
}

/** A short confirmation across the top of the run (e.g. after a resync). */
export function noticeOverlay(run: TextRun, value: string, opacity = 1): string {
    if (opacity <= 0) return "";
    return inRun(run, [backed(run.width / 2, 15, value, 13, "#6cc4ff", "bold", opacity)]);
}

type SungLayout = { lines: string[]; size: number; top: number; gap: number };

/** Largest first: two lines stay big, three lines only when two don't fit even at 18 px. */
const STEPS: [size: number, lines: number][] = [
    [SUNG, 2],
    [20, 2],
    [18, 2],
    [18, 3],
    [16, 3],
];

/** The sung block centered around y = 40 (the next line sits below it). */
function sungLayout(value: string, max: number): SungLayout {
    if (!value) return { lines: [], size: SUNG, top: 0, gap: 0 };
    for (const [size, maxLines] of STEPS) {
        const lines = balanceLines(value, size, max, maxLines, true);
        if (lines) return place(lines, size);
    }
    return place(wrapToWidth(value, 16, max, 3, true), 16);
}

function place(lines: string[], size: number): SungLayout {
    const gap = Math.round(size * 1.2);
    return { lines, size, gap, top: Math.round(40 + size * 0.35 - ((lines.length - 1) * gap) / 2) };
}

function sungLines(cx: number, layout: SungLayout, opacity: number, dy: number): string[] {
    if (!layout.lines.length) return [label(cx, 54 + dy, "♪", 26, "#b0b0b6", "normal", "middle", opacity)];
    return layout.lines.map((l, i) => backed(cx, layout.top + i * layout.gap + dy, l, layout.size, "#ffffff", "bold", opacity));
}

/** A centered line on its own dark box, so the effect stays bright around the text. */
function backed(cx: number, y: number, value: string, size: number, color: string, weight: string, opacity: number): string {
    if (!value || opacity <= 0) return "";
    const w = measureArialWidth(value, size, weight === "bold") + 16;
    const box = `<rect x="${(cx - w / 2).toFixed(1)}" y="${(y - size - 2).toFixed(1)}" width="${w.toFixed(1)}" height="${size + 8}" rx="8" fill="#000" opacity="${(0.5 * opacity).toFixed(2)}"/>`;
    return box + label(cx, y, value, size, color, weight, "middle", opacity);
}

/** A plain text line (no outline — it made the text look washed out on hardware). */
function label(x: number, y: number, value: string, size: number, color: string, weight: string, anchor: "start" | "middle" | "end", opacity: number): string {
    if (!value || opacity <= 0) return "";
    const o = opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : "";
    return `<text x="${x}" y="${y.toFixed(1)}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${o}>${escapeXml(value)}</text>`;
}

/** Run coordinates → this display: shift left by its offset (the SVG viewport clips the rest). */
function inRun(run: TextRun, parts: string[]): string {
    return `<g transform="translate(${-run.offset} 0)">${parts.join("")}</g>`;
}
