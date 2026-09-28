// Countdowns that must go off even while their key or dial isn't on screen (another page or
// profile, just moved). Keys only keep the timer's id and end in their settings and re-attach by
// that id when they appear again; the timers themselves live here, for the whole plugin.

/** How long after its end a missed timer (plugin was down, MA unreachable) still goes off. */
export const CATCH_UP_MS = 5 * 60_000;
/** Wait before trying again when going off failed (e.g. MA not connected). */
export const RETRY_MS = 15_000;

/** Does what the timer is for; false (or throwing) = couldn't right now, try again later. */
export type AlarmFire = () => Promise<boolean>;

type Entry = { end: number; fire: AlarmFire; handle?: ReturnType<typeof setTimeout> };

export class AlarmTimers {
    private readonly timers = new Map<string, Entry>();
    /** Timers that went off (or were given up) since the plugin started. */
    private readonly finished = new Set<string>();
    private readonly listeners = new Set<(id: string) => void>();

    isRunning(id: string): boolean {
        return this.timers.has(id);
    }

    hasFinished(id: string): boolean {
        return this.finished.has(id);
    }

    /** Run `fire` at `end` (ms since epoch); an end in the past goes off right away (within CATCH_UP_MS). */
    start(id: string, end: number, fire: AlarmFire): void {
        this.cancel(id);
        this.finished.delete(id);
        const entry: Entry = { end, fire };
        this.timers.set(id, entry);
        this.schedule(id, entry, end - Date.now());
    }

    cancel(id: string): void {
        clearTimeout(this.timers.get(id)?.handle);
        this.timers.delete(id);
    }

    /** Called when a timer went off or was given up. */
    onFinished(listener: (id: string) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private schedule(id: string, entry: Entry, delay: number): void {
        entry.handle = setTimeout(() => void this.run(id, entry), Math.max(0, delay));
    }

    private async run(id: string, entry: Entry): Promise<void> {
        if (this.timers.get(id) !== entry) return;
        if (Date.now() - entry.end > CATCH_UP_MS) return this.finish(id); // too late to be useful
        let done = false;
        try {
            done = await entry.fire();
        } catch {
            done = false;
        }
        if (this.timers.get(id) !== entry) return; // cancelled or restarted meanwhile
        if (done) return this.finish(id);
        this.schedule(id, entry, RETRY_MS);
    }

    private finish(id: string): void {
        this.timers.delete(id);
        this.finished.add(id);
        for (const l of this.listeners) l(id);
    }
}

export const alarmTimers = new AlarmTimers();
