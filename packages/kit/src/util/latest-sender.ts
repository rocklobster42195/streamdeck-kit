/**
 * Sends only the latest value, at most once per `intervalMs` — the first immediately, the last
 * always (trailing). Dials emit many ticks per second; the UI shows every step optimistically,
 * but the server only needs to see where the user ended up.
 */
export class LatestSender<T> {
    private pending: { value: T } | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly send: (value: T) => Promise<unknown>,
        private readonly intervalMs = 150,
        private readonly onError: (e: unknown) => void = () => {},
    ) {}

    push(value: T): void {
        if (this.timer) {
            this.pending = { value };
            return;
        }
        this.fire(value);
    }

    private fire(value: T): void {
        this.send(value).catch(this.onError);
        this.timer = setTimeout(() => {
            this.timer = undefined;
            const next = this.pending;
            this.pending = undefined;
            if (next) this.fire(next.value);
        }, this.intervalMs);
    }
}
