// Seek mode for a Next/Previous key (grill 2026-10-04): a long press switches the key to seeking,
// every tap moves the target by one step and shows it at once, and only after a short quiet time
// does one seek go to the player (6 quick taps of 10 s → one jump of +1:00). The mode ends by
// itself after a while without a tap. Kept SDK-free; the key draws from `offset` and `target`.

export type SeekStepperOptions = {
    /** Where the player is now (seconds), or undefined when unknown. */
    position: () => number | undefined;
    /** The track's length (seconds); undefined = nothing to seek (radio, a stream). */
    duration: () => number | undefined;
    /** Sends the one seek (seconds). */
    seek: (target: number) => void;
    /** Something to draw changed (mode, offset, target). */
    onChange?: () => void;
    /** Quiet time before the seek goes out (default 400 ms). */
    quietMs?: number;
    /** The mode ends after this long without a tap (default 3000 ms). */
    idleMs?: number;
};

/** Seek steps the PI offers (seconds); 10 is the default. */
export const SEEK_STEPS = [5, 10, 15, 30] as const;
export const DEFAULT_SEEK_STEP = 10;

export class SeekStepper {
    private on = false;
    private base: number | undefined;
    private delta = 0;
    private quiet: ReturnType<typeof setTimeout> | undefined;
    private idle: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly o: SeekStepperOptions) {}

    /** In seek mode now. */
    get active(): boolean {
        return this.on;
    }

    /** Whether the player can seek at all (it has a duration and a position). */
    get possible(): boolean {
        return !!this.o.duration() && this.o.position() !== undefined;
    }

    /** The taps not sent yet, in seconds (e.g. +30 for three taps of 10 s); 0 when none wait. */
    get offset(): number {
        return this.delta;
    }

    /** Where the waiting taps will land (seconds); undefined when none wait. */
    get target(): number | undefined {
        return this.base === undefined ? undefined : this.clamp(this.base + this.delta);
    }

    /** Switches seek mode on (from a long press). Returns false when the player can't seek. */
    enter(): boolean {
        if (!this.possible) return false;
        this.on = true;
        this.armIdle();
        this.o.onChange?.();
        return true;
    }

    /** Leaves seek mode; taps still waiting go out first. */
    exit(): void {
        if (!this.on) return;
        this.flush();
        this.on = false;
        clearTimeout(this.idle);
        this.o.onChange?.();
    }

    /** One tap: `by` seconds forward (negative: back). Ignored outside seek mode. */
    tap(by: number): void {
        if (!this.on) return;
        if (this.base === undefined) {
            const pos = this.o.position();
            if (pos === undefined || !this.o.duration()) return this.exit();
            this.base = pos;
        }
        this.delta += by;
        // Don't count past either end: further taps there do nothing
        this.delta = this.clamp(this.base + this.delta) - this.base;
        clearTimeout(this.quiet);
        this.quiet = setTimeout(() => this.flush(), this.o.quietMs ?? 400);
        this.armIdle();
        this.o.onChange?.();
    }

    /** Stops timers without sending (the key went away). */
    dispose(): void {
        clearTimeout(this.quiet);
        clearTimeout(this.idle);
        this.on = false;
        this.base = undefined;
        this.delta = 0;
    }

    private flush(): void {
        clearTimeout(this.quiet);
        const target = this.target;
        this.base = undefined;
        this.delta = 0;
        if (target !== undefined) this.o.seek(target);
        this.o.onChange?.();
    }

    private armIdle(): void {
        clearTimeout(this.idle);
        this.idle = setTimeout(() => this.exit(), this.o.idleMs ?? 3000);
    }

    /** Between 0 and one second before the end, so a seek never skips to the next track. */
    private clamp(s: number): number {
        const d = this.o.duration();
        return Math.max(0, d ? Math.min(s, Math.max(0, d - 1)) : s);
    }
}
