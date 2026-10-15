// Counts quick taps on a key (grill 2026-10-15, GitHub issues #4/#5 of SO-C): Stream Deck only
// reports key down and key up, so a double or triple tap has to be counted by the plugin. A tap
// waits for the next one up to `windowMs`; the count is final when the window runs out or when
// `max` taps are in (no waiting for a tap that can't change anything). SDK-free.

export type TapCounterOptions = {
    /** The most taps that mean something (default 3). */
    max?: number;
    /** Timer functions, for tests. */
    setTimeout?: (fn: () => void, ms: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
};

export class TapCounter {
    private readonly pending = new Map<string, { count: number; timer: unknown }>();
    private readonly max: number;
    private readonly set: NonNullable<TapCounterOptions['setTimeout']>;
    private readonly clear: NonNullable<TapCounterOptions['clearTimeout']>;

    constructor(options: TapCounterOptions = {}) {
        this.max = options.max ?? 3;
        this.set = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
        this.clear = options.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    }

    /** A tap on `id`: `done(count)` runs once, when the taps of this burst are final. */
    tap(id: string, windowMs: number, done: (count: number) => void): void {
        const p = this.pending.get(id);
        if (p) this.clear(p.timer);
        const count = (p?.count ?? 0) + 1;
        const finish = () => {
            this.pending.delete(id);
            done(count);
        };
        if (count >= this.max) return finish();
        this.pending.set(id, { count, timer: this.set(finish, windowMs) });
    }

    /** Drop a key's burst without a result (the key went away). */
    cancel(id: string): void {
        const p = this.pending.get(id);
        if (p) this.clear(p.timer);
        this.pending.delete(id);
    }
}
