import { kitLog } from "../log.js";

// Small LRU of cover images as data URIs, keyed by URL. Shared by all actions.
const MAX_ENTRIES = 40;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();

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
    let p = inflight.get(url);
    if (!p) {
        p = fetchAsDataUri(url).finally(() => inflight.delete(url));
        inflight.set(url, p);
    }
    return p;
}

async function fetchAsDataUri(url: string): Promise<string | undefined> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = res.headers.get("content-type") ?? "image/jpeg";
        const data = Buffer.from(await res.arrayBuffer()).toString("base64");
        const uri = `data:${type};base64,${data}`;
        cache.set(url, uri);
        while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        return uri;
    } catch (e) {
        kitLog().warn(`[cover] failed to load ${url}`, e);
        return undefined;
    }
}
