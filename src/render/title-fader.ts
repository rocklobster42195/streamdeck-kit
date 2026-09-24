// Ported from sonos-controller's TitleAnimator (src/utils/TitleAnimator.ts) — keep both in sync.
// A key title that fades in step by step: first the dark band, then the text while it starts to
// scroll; it scrolls until its end reaches the right edge, fades out in reverse order (text, then
// band), pauses, and starts over. Short titles stand still, centered, instead of scrolling.
//
// Tick-based on purpose: every tick moves the text by exactly the same number of pixels. A
// time-based offset jumps unevenly whenever a frame reaches the device late, which reads as
// stutter on hardware. The state machine is pure — the host decides the tick rate (sonos: 80 ms).
import { measureArialWidth } from './text-width.js';

export type TitleFaderConfig = {
    /** Key image size in px (sonos renders 72; its values are scaled from there). */
    size: number;
    /** Where the text starts (and where short titles are centered from). */
    startX: number;
    /** Scrolling ends once the text's end has moved in to here. */
    endX: number;
    /** Pixels per tick. */
    speed: number;
    /** Ticks a short title stands still, and the pause between loops. */
    pauseTicks: number;
    fontSize: number;
    /** Text baseline. */
    y: number;
    boxMax: number;
    boxStep: number;
    textStep: number;
};

/** sonos-controller's values (72 px keys, play/pause key: 80 ms ticks, 120-tick pause) scaled to 144 px. */
export const SONOS_TITLE_FADER: TitleFaderConfig = {
    size: 144,
    startX: 36,
    endX: 144,
    speed: 2.2,
    pauseTicks: 120,
    fontSize: 26,
    y: 120,
    boxMax: 0.3,
    boxStep: 0.05,
    textStep: 0.1,
};

enum Phase {
    BoxIn,
    ScrollAndFadeIn,
    Scroll,
    ScrollAndFadeOut,
    BoxOut,
    Pause,
}

export class TitleFader {
    private phase = Phase.BoxIn;
    private offset = 0;
    private box = 0;
    private textOpacity = 0;
    private ticks = 0;
    private textWidth = 0;
    private scrolls = false;
    private current = '';

    constructor(
        text: string,
        readonly config: TitleFaderConfig = SONOS_TITLE_FADER,
    ) {
        this.setText(text);
    }

    get text(): string {
        return this.current;
    }

    /** A new title restarts the sequence; the same one keeps running. */
    setText(text: string): void {
        if (text === this.current) return;
        this.current = text;
        const c = this.config;
        this.textWidth = measureArialWidth(text, c.fontSize, true);
        this.scrolls = c.startX + this.textWidth > c.endX;
        this.restart();
    }

    /** Advance one tick. Returns false while nothing visible changes (the pause between loops). */
    step(): boolean {
        const c = this.config;
        switch (this.phase) {
            case Phase.BoxIn:
                this.box = Math.min(c.boxMax, this.box + c.boxStep);
                if (this.box >= c.boxMax) this.phase = this.scrolls ? Phase.ScrollAndFadeIn : Phase.Scroll;
                return true;
            case Phase.ScrollAndFadeIn:
                this.offset += c.speed;
                this.textOpacity = Math.min(1, this.textOpacity + c.textStep);
                if (this.textOpacity >= 1) this.phase = Phase.Scroll;
                return true;
            case Phase.Scroll:
                if (this.scrolls) {
                    this.offset += c.speed;
                    if (c.startX - this.offset + this.textWidth <= c.endX) this.phase = Phase.ScrollAndFadeOut;
                    return true;
                }
                // Short title: fade in, stand still, fade out
                if (this.textOpacity < 1) {
                    this.textOpacity = Math.min(1, this.textOpacity + c.textStep);
                    return true;
                }
                if (++this.ticks > c.pauseTicks) this.phase = Phase.ScrollAndFadeOut;
                return false;
            case Phase.ScrollAndFadeOut:
                if (this.scrolls) this.offset += c.speed;
                this.textOpacity = Math.max(0, this.textOpacity - c.textStep);
                if (this.textOpacity <= 0) this.phase = Phase.BoxOut;
                return true;
            case Phase.BoxOut:
                this.box = Math.max(0, this.box - c.boxStep);
                if (this.box <= 0) {
                    this.phase = Phase.Pause;
                    this.ticks = c.pauseTicks;
                }
                return true;
            case Phase.Pause:
                if (this.ticks > 0) {
                    this.ticks--;
                    return false;
                }
                this.restart();
                return true;
        }
    }

    /** SVG fragment for the key image: the band and the (partly transparent) text. */
    svg(color = '#ffffff'): string {
        const c = this.config;
        if (this.box <= 0 && this.textOpacity <= 0) return '';
        const top = c.y - c.fontSize - 4;
        const x = this.scrolls ? c.startX - this.offset : c.startX + (c.endX - c.startX - this.textWidth) / 2;
        const band = `<rect x="0" y="${top}" width="${c.size}" height="${c.fontSize + 16}" fill="#000" fill-opacity="${this.box.toFixed(2)}"/>`;
        if (this.textOpacity <= 0) return band;
        return `${band}<text x="${x.toFixed(1)}" y="${c.y}" fill="${color}" fill-opacity="${this.textOpacity.toFixed(2)}" font-family="Arial,sans-serif" font-size="${c.fontSize}" font-weight="bold">${escapeXml(this.current)}</text>`;
    }

    private restart(): void {
        this.phase = Phase.BoxIn;
        this.offset = 0;
        this.box = 0;
        this.textOpacity = 0;
        this.ticks = 0;
    }
}

function escapeXml(s: string): string {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
