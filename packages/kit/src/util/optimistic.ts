/**
 * Short-lived local overrides for server state ("optimistic UI").
 *
 * MA coalesces fast command sequences and only reports the end state, so a key that waits for the
 * confirming event feels laggy or skips steps. Instead we patch the fields we just changed for a
 * moment; every reader sees the patched object until the patch expires, is cleared, or the server
 * reports the same value (confirmed) — after that, changes made elsewhere show up immediately.
 */
export class OptimisticStore<T extends object> {
    private readonly patches = new Map<string, Map<keyof T, { value: unknown; until: number }>>();

    constructor(private readonly now: () => number = Date.now) {}

    set(id: string, patch: Partial<T>, ms: number): void {
        let fields = this.patches.get(id);
        if (!fields) this.patches.set(id, (fields = new Map()));
        const until = this.now() + ms;
        for (const [key, value] of Object.entries(patch) as [keyof T, unknown][]) fields.set(key, { value, until });
    }

    clear(id: string, keys?: (keyof T)[]): void {
        if (!keys) return void this.patches.delete(id);
        const fields = this.patches.get(id);
        for (const k of keys) fields?.delete(k);
    }

    /** The object with all still-valid patches applied (the original if there are none). */
    apply(id: string, obj: T): T {
        const fields = this.patches.get(id);
        if (!fields?.size) return obj;
        const now = this.now();
        let result: T | undefined;
        for (const [key, p] of fields) {
            if (p.until <= now || Object.is(obj[key], p.value)) {
                fields.delete(key);
                continue;
            }
            result ??= { ...obj };
            (result as any)[key] = p.value;
        }
        return result ?? obj;
    }
}
