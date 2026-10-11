import { kitLog } from "../log.js";
import { runThrottled } from "../util/per-host-throttle.js";

// LRU of cover images as data URIs, keyed by URL, shared by all actions. Hardened with
// sonos-controller's hardware lessons:
// - concurrent callers for one URL share one request;
// - at most two fetches per host run at once (runThrottled), so a list browsing covers doesn't
//   starve the current track's cover on a small device;
// - a request that hangs is aborted at the socket (it would otherwise hold its throttle slot);
// - a failed URL is not retried for a few seconds — long enough to collapse a burst of callers
//   (every poll, every re-render) into one attempt, short enough that a transient failure at a
//   track change doesn't leave the previous cover standing for long;
// - empty bodies and non-image answers count as failures;
// - a plugin may give a resize hook (sharp) so the cached cover is key-sized, not as served.
const FETCH_TIMEOUT_MS = 8000;
let maxEntries = 100;
let failureCooldownMs = 5000;
/** Brings a fetched cover down to what a key or strip shows (set by the plugin; none: kept as served). */
export type CoverResize = (body: Buffer, type: string) => Promise<{ body: Buffer; type: string } | undefined>;
let resize: CoverResize | undefined;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();
const failedAt = new Map<string, number>();

/** Cache size (default 100 covers) and how long a failed URL rests (default 5 s). */
export function configureCoverCache(o: { maxEntries?: number; failureCooldownMs?: number; resize?: CoverResize }): void {
    if (o.resize !== undefined) resize = o.resize;
    if (o.maxEntries !== undefined) maxEntries = Math.max(1, o.maxEntries);
    if (o.failureCooldownMs !== undefined) failureCooldownMs = Math.max(0, o.failureCooldownMs);
}

export function getCachedCover(url: string): string | undefined {
    const hit = cache.get(url);
    if (hit) {
        // refresh LRU position
        cache.delete(url);
        cache.set(url, hit);
    }
    return hit;
}

/** Fetch a cover once; concurrent callers share the same request. Resolves undefined on failure. */
export function loadCover(url: string): Promise<string | undefined> {
    const hit = getCachedCover(url);
    if (hit) return Promise.resolve(hit);
    const failed = failedAt.get(url);
    if (failed !== undefined && Date.now() - failed < failureCooldownMs) return Promise.resolve(undefined);
    let p = inflight.get(url);
    if (!p) {
        p = runThrottled(hostOf(url), () => fetchAsDataUri(url)).finally(() => inflight.delete(url));
        inflight.set(url, p);
    }
    return p;
}

function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return "";
    }
}

async function fetchAsDataUri(url: string): Promise<string | undefined> {
    // An AbortController cancels the request itself (not just abandons it), so a hanging one
    // frees its throttle slot
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: abort.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = res.headers.get("content-type") ?? "image/jpeg";
        if (!type.startsWith("image/") && !type.startsWith("binary/")) throw new Error(`not an image (${type})`);
        const body = await res.arrayBuffer();
        if (!body.byteLength) throw new Error("empty body");
        let bytes = Buffer.from(body);
        let mime = type;
        // A server's cover may be 640 px and 200 KB for a 144 px key, sent again with every frame
        if (resize) {
            try {
                const small = await resize(bytes, type);
                if (small && small.body.length < bytes.length) {
                    bytes = small.body;
                    mime = small.type;
                }
            } catch (e) {
                kitLog().warn(`[cover] resize failed for ${url}`, e);
            }
        }
        const uri = `data:${mime};base64,${bytes.toString("base64")}`;
        failedAt.delete(url);
        cache.set(url, uri);
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
        return uri;
    } catch (e) {
        failedAt.set(url, Date.now());
        kitLog().warn(`[cover] failed to load ${url}`, e);
        return undefined;
    } finally {
        clearTimeout(timer);
    }
}
