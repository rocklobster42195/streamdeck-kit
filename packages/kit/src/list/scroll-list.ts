// Scroll state of a dial list: a target row that moves one row per dial tick, and a position that
// glides there (ease-out), so the rows move smoothly and the marker switches halfway.
//
// Hardware test 2026-10-03 (MA-C): half a row per tick with a snap afterwards only looked like a
// pause, so one tick is one row. Fast spins (several ticks in one event) move two rows per tick.
import { AnimatedValue } from '../render/animation.js';

export type ScrollListOptions = {
    /** Glide duration for one move (ms). */
    glideMs?: number;
    /** Ticks per event from which a spin counts as fast (two rows per tick). */
    fastTicks?: number;
    /** Rubber-band nudge at the ends, in rows, and how long it lasts (ms). */
    bounceRows?: number;
    bounceMs?: number;
    clock?: () => number;
};

export class ScrollList {
    private count = 0;
    private to = 0;
    private dir = 1;
    private readonly glide: AnimatedValue;
    private bounceAt = 0;
    private bounceDir = 0;
    private readonly clock: () => number;
    private readonly fastTicks: number;
    private readonly bounceRows: number;
    private readonly bounceMs: number;

    constructor(opts: ScrollListOptions = {}) {
        this.clock = opts.clock ?? Date.now;
        this.fastTicks = opts.fastTicks ?? 3;
        this.bounceRows = opts.bounceRows ?? 0.15;
        this.bounceMs = opts.bounceMs ?? 220;
        this.glide = new AnimatedValue(0, opts.glideMs ?? 260, this.clock);
    }

    get length(): number {
        return this.count;
    }

    /** The row the list is moving to (or resting on). */
    get index(): number {
        return this.to;
    }

    /** New content: set the row count and jump (without gliding) to `index`. */
    reset(length: number, index = 0): void {
        this.count = Math.max(0, length);
        this.to = this.clamp(index);
        this.glide.reset(this.to);
        this.bounceAt = 0;
    }

    /** The row count changed (e.g. a page loaded); keeps the position. */
    setLength(length: number): void {
        this.count = Math.max(0, length);
        const clamped = this.clamp(this.to);
        if (clamped !== this.to) this.jump(clamped);
    }

    /** Glide to a row (e.g. back to the current track). */
    moveTo(index: number): void {
        const to = this.clamp(index);
        if (to !== this.to) this.dir = Math.sign(to - this.to);
        this.to = to;
        this.glide.set(to);
    }

    /** Jump to a row without gliding. */
    jump(index: number): void {
        this.to = this.clamp(index);
        this.glide.reset(this.to);
    }

    /** One dial event. Returns whether anything moves (a glide or a bounce at the ends). */
    rotate(ticks: number): boolean {
        if (!ticks || !this.count) return false;
        const rows = Math.abs(ticks) >= this.fastTicks ? ticks * 2 : ticks;
        const wanted = this.to + rows;
        const to = this.clamp(wanted);
        this.dir = Math.sign(ticks);
        if (to !== wanted) {
            this.bounceAt = this.clock();
            this.bounceDir = Math.sign(ticks);
        }
        this.to = to;
        this.glide.set(to);
        return true;
    }

    /** Fractional row at the centre, including the rubber-band nudge. */
    get position(): number {
        return this.glide.value() + this.bounce();
    }

    /** The row nearest the centre; exactly halfway counts for the row the list is moving to. */
    get marked(): number {
        if (!this.count) return -1;
        const p = this.glide.value();
        const f = p - Math.floor(p);
        const row = Math.abs(f - 0.5) < 1e-6 ? (this.dir < 0 ? Math.floor(p) : Math.ceil(p)) : Math.round(p);
        return this.clamp(row);
    }

    get moving(): boolean {
        return this.glide.animating || this.bounce() !== 0;
    }

    private bounce(): number {
        if (!this.bounceAt) return 0;
        const t = (this.clock() - this.bounceAt) / this.bounceMs;
        if (t >= 1) {
            this.bounceAt = 0;
            return 0;
        }
        return Math.sin(Math.PI * t) * this.bounceRows * this.bounceDir;
    }

    private clamp(i: number): number {
        return this.count ? Math.min(this.count - 1, Math.max(0, Math.round(i))) : 0;
    }
}
