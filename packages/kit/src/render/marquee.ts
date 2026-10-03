// Scrolling text for Stream Deck key images and touch-strip SVGs.
//
// The scroll position is a pure function of the start time and "now" (deterministic and testable,
// one shared FrameTicker drives the redraws), but it moves in whole ticks: every frame shifts the
// text by the same number of pixels. A continuous time-based offset jumps unevenly whenever a frame
// reaches the device late, which reads as stutter on hardware (sonos-controller's MarqueeAnimator
// steps 1 px per tick for the same reason). Match `tickMs` to the ticker that drives the redraws.
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
    /** Redraw interval the text moves in (ms). */
    tickMs?: number;
    /** A counted offset (e.g. from MarqueeStepper) instead of one from startedAt/now. */
    offset?: number;
};

const GAP = 28;

/** Does `text` need to scroll in `width` px? */
export function marqueeNeeded(text: string, fontSize: number, width: number): boolean {
    return measureArialWidth(text, fontSize) > width;
}

/** Default redraw interval (ms) — the plugin's shared frame ticker. */
export const MARQUEE_TICK_MS = 80;

/** Current scroll offset in px (0 during the pause at the start of each loop), moving in whole ticks. */
export function marqueeOffset(textWidth: number, startedAt: number, now: number, speed = 40, pauseMs = 1500, tickMs = MARQUEE_TICK_MS): number {
    const cycle = textWidth + GAP;
    const loopMs = pauseMs + (cycle / speed) * 1000;
    const t = (now - startedAt) % loopMs;
    if (t < pauseMs) return 0;
    const step = (speed * tickMs) / 1000;
    return Math.floor((t - pauseMs) / tickMs) * step;
}

/**
 * Counted marquee steps: every tick() moves the text by whole pixels at a fixed rhythm — n px per
 * tick, or 1 px every k ticks when slower — and a frame that reaches the device late shows the next
 * step, not a jump. A time-based offset skips ahead after a late frame, which reads as an
 * occasional hitch (sonos-controller, hardware 2026-10-03); fractional steps (0.5 px) judder.
 */
export class MarqueeStepper {
    private ticks = 0;

    constructor(
        /** Pixels per second (rounded to whole pixels per tick). */
        public speed = 40,
        /** Still time at the start of every loop (ms). */
        public pauseMs = 1500,
        readonly tickMs = MARQUEE_TICK_MS,
    ) {}

    /** Start over (e.g. a new text). */
    reset(): void {
        this.ticks = 0;
    }

    tick(): void {
        this.ticks++;
    }

    /** Offset in px for a text of this width; 0 during the pause at the start of each loop. */
    offset(textWidth: number): number {
        const perTick = (this.speed * this.tickMs) / 1000;
        const px = perTick >= 1 ? Math.round(perTick) : 1;
        const every = perTick >= 1 ? 1 : Math.max(1, Math.round(1 / Math.max(perTick, 1e-6)));
        const pauseTicks = Math.round(this.pauseMs / this.tickMs);
        const loop = pauseTicks + Math.ceil((textWidth + GAP) / px) * every;
        const t = this.ticks % loop;
        return t < pauseTicks ? 0 : Math.floor((t - pauseTicks) / every) * px;
    }
}

/** SVG fragment: static text if it fits, otherwise two copies scrolling left under a fade mask. */
export function marqueeSvg(o: MarqueeOptions): string {
    const color = o.color ?? '#ffffff';
    const text = escapeXml(o.text);
    const attrs = `fill="${color}" font-family="Arial,sans-serif" font-size="${o.fontSize}" font-weight="${o.weight ?? 'normal'}"`;
    const textWidth = measureArialWidth(o.text, o.fontSize);
    if (textWidth <= o.width) return `<text x="${o.x}" y="${o.y}" ${attrs}>${text}</text>`;

    const cycle = textWidth + GAP;
    const offset = o.offset !== undefined ? o.offset % cycle : marqueeOffset(textWidth, o.startedAt, o.now, o.speed, o.pauseMs, o.tickMs);
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
