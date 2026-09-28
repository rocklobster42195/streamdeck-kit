// Small animation helpers for Stream Deck images: a value that eases toward a target, and one
// shared frame ticker that redraws only while something is moving.

/** A number that eases to its target over `durationMs` (ease-out). */
export class AnimatedValue {
    private from: number;
    private to: number;
    private startedAt = 0;

    constructor(
        initial: number,
        private readonly durationMs = 250,
        private readonly clock: () => number = Date.now,
    ) {
        this.from = initial;
        this.to = initial;
    }

    get target(): number {
        return this.to;
    }

    /** Aim for a new value; continues smoothly from wherever the animation currently is. */
    set(target: number): void {
        if (target === this.to) return;
        this.from = this.value();
        this.to = target;
        this.startedAt = this.clock();
    }

    /** Jump without animating (e.g. the first value). */
    reset(value: number): void {
        this.from = this.to = value;
        this.startedAt = 0;
    }

    value(): number {
        const t = Math.min(1, (this.clock() - this.startedAt) / this.durationMs);
        if (t >= 1) return this.to;
        const eased = 1 - (1 - t) ** 3;
        return this.from + (this.to - this.from) * eased;
    }

    get animating(): boolean {
        return this.value() !== this.to;
    }
}

/**
 * Calls registered frame callbacks every `intervalMs` while at least one of them says it still
 * needs frames (returns true). The interval stops by itself when everything is at rest.
 */
export class FrameTicker {
    private readonly active = new Map<string, () => boolean>();
    private timer: ReturnType<typeof setInterval> | undefined;

    constructor(private readonly intervalMs = 100) {}

    /** Keep calling `frame` until it returns false (or {@link stop} is called for `id`). */
    run(id: string, frame: () => boolean): void {
        this.active.set(id, frame);
        if (!this.timer) this.timer = setInterval(() => this.tick(), this.intervalMs);
    }

    stop(id: string): void {
        this.active.delete(id);
        if (!this.active.size) this.halt();
    }

    get running(): boolean {
        return !!this.timer;
    }

    private tick(): void {
        for (const [id, frame] of [...this.active]) {
            let more = false;
            try {
                more = frame();
            } catch {
                more = false;
            }
            if (!more) this.active.delete(id);
        }
        if (!this.active.size) this.halt();
    }

    private halt(): void {
        clearInterval(this.timer);
        this.timer = undefined;
    }
}
