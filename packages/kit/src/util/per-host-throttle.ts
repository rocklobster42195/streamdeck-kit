// Caps concurrent async work per host key (e.g. a speaker's address). Ported from
// sonos-controller: several parts of a plugin (the current track's cover, a list dial browsing)
// fetch images from the same small embedded device — without a shared cap they compete for the
// same connection pool instead of "at most a couple in flight at once", each starving the other
// (found on hardware: fixing one side's fetch pattern just shifted the slowness onto the other).
let maxConcurrentPerHost = 2;

/** How many tasks may run at once per host (default 2). */
export function setMaxConcurrentPerHost(n: number): void {
    maxConcurrentPerHost = Math.max(1, Math.floor(n));
}

interface HostQueue {
    active: number;
    waiters: (() => void)[];
}

const hostQueues: Map<string, HostQueue> = new Map();

function acquire(host: string): Promise<void> {
    let q = hostQueues.get(host);
    if (!q) { q = { active: 0, waiters: [] }; hostQueues.set(host, q); }
    if (q.active < maxConcurrentPerHost) {
        q.active++;
        return Promise.resolve();
    }
    return new Promise<void>(resolve => q!.waiters.push(resolve));
}

function release(host: string): void {
    const q = hostQueues.get(host);
    if (!q) return;
    const next = q.waiters.shift();
    if (next) { next(); return; } // slot passes straight to the next waiter — active count unchanged
    q.active = Math.max(0, q.active - 1);
}

export function runThrottled<T>(host: string, fn: () => Promise<T>): Promise<T> {
    return acquire(host).then(() => fn().finally(() => release(host)));
}
