// The receiving side of deckbus ducking (docs/deckbus-protocol.md, "duck"/"unduck"): a peer asks
// to lower a level for a while. Several peers may duck the same target; the deepest wins. A lease
// ends on "unduck", after its maxMs, or when its peer leaves the bus; the plugin then restores the
// level. The plugin decides which peers may duck at all (only those the user allowed) and how a
// gain in dB is applied to its own device. Kept SDK-free.
import type { DeckBus, PeerInfo } from "./bus.js";

export type DuckRequest = {
    /** What to lower, usually one of the peer's stream topics, e.g. "meters/system-output". */
    target: string;
    /** dB, negative (e.g. -12). */
    by: number;
    rampMs: number;
    maxMs: number;
};

/** A target's gain changed: `db` is 0 when it is back to normal. */
export type DuckChange = { target: string; db: number; rampMs: number };

export const DUCK_LIMITS = { minBy: -60, defaultRampMs: 300, maxRampMs: 5000, defaultMaxMs: 30_000, maxMaxMs: 300_000 } as const;

/** Checks and clamps a "duck" request's params; throws on a missing target or a bad `by`. */
export function parseDuck(params: unknown): DuckRequest {
    const p = (params ?? {}) as Record<string, unknown>;
    if (typeof p.target !== "string" || !p.target) throw new Error("duck: target missing");
    const by = Number(p.by);
    if (!Number.isFinite(by)) throw new Error("duck: by must be a number (dB)");
    return {
        target: p.target,
        by: Math.max(DUCK_LIMITS.minBy, Math.min(0, by)),
        rampMs: clampMs(p.rampMs, DUCK_LIMITS.defaultRampMs, DUCK_LIMITS.maxRampMs),
        maxMs: clampMs(p.maxMs, DUCK_LIMITS.defaultMaxMs, DUCK_LIMITS.maxMaxMs) || DUCK_LIMITS.defaultMaxMs,
    };
}

type Lease = { by: number; rampMs: number; timer: ReturnType<typeof setTimeout> };

/** The ducks per target and peer; calls `apply` whenever a target's gain changes. */
export class DuckLeases {
    /** target → peer id → lease */
    private readonly leases = new Map<string, Map<string, Lease>>();
    private readonly depths = new Map<string, number>();

    constructor(private readonly apply: (change: DuckChange) => void) {}

    duck(peer: string, r: DuckRequest): void {
        let byPeer = this.leases.get(r.target);
        if (!byPeer) this.leases.set(r.target, (byPeer = new Map()));
        clearTimeout(byPeer.get(peer)?.timer);
        const timer = setTimeout(() => this.unduck(peer, r.target), r.maxMs);
        byPeer.set(peer, { by: r.by, rampMs: r.rampMs, timer });
        this.update(r.target, r.rampMs);
    }

    unduck(peer: string, target: string): void {
        const lease = this.leases.get(target)?.get(peer);
        if (!lease) return;
        clearTimeout(lease.timer);
        this.leases.get(target)!.delete(peer);
        this.update(target, lease.rampMs);
    }

    /** All leases of a peer end (it left the bus, or the user took its permission back). */
    leave(peer: string): void {
        for (const target of [...this.leases.keys()]) this.unduck(peer, target);
    }

    /** Forget a target's leases without restoring (the user set the level by hand, the device went). */
    release(target: string): void {
        for (const lease of this.leases.get(target)?.values() ?? []) clearTimeout(lease.timer);
        this.leases.delete(target);
        this.depths.delete(target);
    }

    /** The target's current gain in dB (0 = not ducked). */
    depth(target: string): number {
        return this.depths.get(target) ?? 0;
    }

    /** Peers that hold at least one lease. */
    peers(): string[] {
        return [...new Set([...this.leases.values()].flatMap((m) => [...m.keys()]))];
    }

    private update(target: string, rampMs: number): void {
        const byPeer = this.leases.get(target);
        const db = Math.min(0, ...[...(byPeer?.values() ?? [])].map((l) => l.by));
        if (!byPeer?.size) this.leases.delete(target);
        if (db === this.depth(target)) return;
        if (db === 0) this.depths.delete(target);
        else this.depths.set(target, db);
        this.apply({ target, db, rampMs });
    }
}

export type ServeDuckingOptions = {
    /** Whether this peer may duck (the user's choice); unduck is always accepted. */
    allow: (peer: PeerInfo) => boolean;
    /** Whether `target` is something this plugin can lower right now. */
    has: (target: string) => boolean;
};

/** Answer "duck" and "unduck" on the bus; ends a peer's leases when it leaves. */
export function serveDucking(bus: Pick<DeckBus, "handle" | "onPeers">, leases: DuckLeases, o: ServeDuckingOptions): () => void {
    bus.handle(
        "duck",
        (params, peer) => {
            const r = parseDuck(params);
            if (!o.has(r.target)) throw new Error(`duck: unknown target ${r.target}`);
            leases.duck(peer.id, r);
            return { db: leases.depth(r.target) };
        },
        o.allow,
    );
    bus.handle(
        "unduck",
        (params, peer) => {
            const target = (params as { target?: unknown } | undefined)?.target;
            if (typeof target !== "string") throw new Error("unduck: target missing");
            leases.unduck(peer.id, target);
            return { db: leases.depth(target) };
        },
        () => true,
    );
    return bus.onPeers((peers) => {
        const here = new Set(peers.map((p) => p.id));
        for (const id of leases.peers()) if (!here.has(id)) leases.leave(id);
    });
}

function clampMs(v: unknown, fallback: number, max: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : fallback;
}
