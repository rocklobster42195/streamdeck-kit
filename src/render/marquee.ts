// Scrolling text for Stream Deck key images and touch-strip SVGs.
//
// Time-based instead of one interval per key (as sonos-controller's MarqueeAnimator does): the
// scroll position is a pure function of the start time and "now", so rendering is deterministic
// and testable, and one shared FrameTicker drives the redraws only while something moves.
import { measureArialWidth } from './text-width.js';

export type MarqueeOptions = {
    /** Unique per image (used for the SVG mask id). */
    id: string;
    text: string;
    x: number;
    /** Text baseline. */
    y: number;
    /** Visible width. */
    width: number;
    fontSize: number;
    color?: string;
    weight?: 'normal' | 'bold';
    /** When scrolling started (ms). Reset it when the text changes. */
    startedAt: number;
    now: number;
    /** Pixels per second. */
    speed?: number;
    /** Still time at the start of every loop (ms). */
    pauseMs?: number;
};

const GAP = 28;

/** Does `text` need to scroll in `width` px? */
export function marqueeNeeded(text: string, fontSize: number, width: number): boolean {
    return measureArialWidth(text, fontSize) > width;
}

/** Current scroll offset in px (0 during the pause at the start of each loop). */
export function marqueeOffset(textWidth: number, startedAt: number, now: number, speed = 40, pauseMs = 1500): number {
    const cycle = textWidth + GAP;
    const loopMs = pauseMs + (cycle / speed) * 1000;
    const t = (now - startedAt) % loopMs;
    return t < pauseMs ? 0 : ((t - pauseMs) / 1000) * speed;
}

/** SVG fragment: static text if it fits, otherwise two copies scrolling left under a fade mask. */
export function marqueeSvg(o: MarqueeOptions): string {
    const color = o.color ?? '#ffffff';
    const text = escapeXml(o.text);
    const attrs = `fill="${color}" font-family="Arial,sans-serif" font-size="${o.fontSize}" font-weight="${o.weight ?? 'normal'}"`;
    const textWidth = measureArialWidth(o.text, o.fontSize);
    if (textWidth <= o.width) return `<text x="${o.x}" y="${o.y}" ${attrs}>${text}</text>`;

    const offset = marqueeOffset(textWidth, o.startedAt, o.now, o.speed, o.pauseMs);
    const cycle = textWidth + GAP;
    const safe = o.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const top = o.y - o.fontSize - 2;
    const h = o.fontSize + 6;
    const fade = Math.min(14, o.width / 5);
    const stop = Math.round(((o.width - fade) / o.width) * 100);
    return (
        `<defs><linearGradient id="mg${safe}" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#fff"/><stop offset="${stop}%" stop-color="#fff"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
        `<mask id="mm${safe}"><rect x="${o.x}" y="${top}" width="${o.width}" height="${h}" fill="url(#mg${safe})"/></mask></defs>` +
        `<g mask="url(#mm${safe})"><text x="${(o.x - offset).toFixed(1)}" y="${o.y}" ${attrs}>${text}</text><text x="${(o.x - offset + cycle).toFixed(1)}" y="${o.y}" ${attrs}>${text}</text></g>`
    );
}

function escapeXml(s: string): string {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
