// deckbus protocol v1 (see docs/deckbus-protocol.md): one JSON object per line (NDJSON).

/** Protocol versions this implementation speaks. */
export const PROTOCOL_VERSIONS = [1];

export type Hello = {
    t: "hello";
    /** Supported protocol versions; the highest common one is used. */
    proto: number[];
    /** The plugin's UUID, e.g. "de.boriskemper.xair-controller". */
    id: string;
    /** Short name, e.g. "XR-C". */
    name: string;
    version: string;
    /** What the peer offers, e.g. ["meters", "duck"]. */
    caps: string[];
    slot: number;
    /** The per-user bus key; a wrong key closes the connection. */
    key: string;
};

export type BusMessage =
    | Hello
    /** The sender's own state; `value` null removes the key. */
    | { t: "state"; key: string; value: unknown }
    | { t: "sub"; topic: string }
    | { t: "unsub"; topic: string }
    /** Stream data, sent only to subscribers of `topic`. */
    | { t: "pub"; topic: string; data: unknown }
    | { t: "req"; id: number; method: string; params?: unknown }
    | { t: "res"; id: number; ok: boolean; result?: unknown; error?: string }
    /** To every peer, fire-and-forget. */
    | { t: "bc"; event: string; data?: unknown }
    /** Sent before closing on purpose (wrong key, no common version). */
    | { t: "bye"; reason: string };

const MAX_LINE = 1 << 20;

/** Splits a byte stream into messages; malformed or oversized lines are dropped. */
export class LineReader {
    private rest = "";

    push(chunk: Buffer | string): BusMessage[] {
        this.rest += chunk.toString();
        const out: BusMessage[] = [];
        let nl: number;
        while ((nl = this.rest.indexOf("\n")) >= 0) {
            const line = this.rest.slice(0, nl);
            this.rest = this.rest.slice(nl + 1);
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line) as BusMessage;
                if (msg && typeof msg === "object" && typeof msg.t === "string") out.push(msg);
            } catch {
                // not JSON: ignore the line, keep the connection
            }
        }
        if (this.rest.length > MAX_LINE) this.rest = "";
        return out;
    }
}

/** Highest version both sides speak, or undefined. */
export function commonVersion(ours: number[], theirs: unknown): number | undefined {
    if (!Array.isArray(theirs)) return undefined;
    const shared = ours.filter((v) => theirs.includes(v));
    return shared.length ? Math.max(...shared) : undefined;
}
