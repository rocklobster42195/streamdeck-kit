// A picture from a web address (a webcam's snapshot): fetched now and then, the last good one kept.
// Meant for the user's own cameras: http(s) only, an optional user and password (Basic), a size
// limit, a timeout, a floor for the interval. Credentials never go into a log line or a status text.
import { kitLog } from '../log.js';

/** What the row settings hold for a picture from a web address. */
export type PanoramaUrlSource = { kind: 'url'; url: string; user?: string; password?: string; intervalSec?: number };

/** What the PI shows below the fields ("fetched 12 s ago" / "Login failed (401)"). */
export type SourceErrorCode = 'badurl' | 'login' | 'http' | 'timeout' | 'connect' | 'big' | 'broke' | 'notpicture' | 'unreadable' | 'other';

/** `code` (and `n`, e.g. the HTTP status) let the PI show the text in the user's language. */
export type SourceStatus = { ok: boolean; at: number; code?: SourceErrorCode; n?: number };

export const MIN_INTERVAL_SEC = 10;
export const DEFAULT_INTERVAL_SEC = 60;
export const MAX_INTERVAL_SEC = 600;
const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

/** A failure that is fine to show the user (no address, no credentials in it); the PI translates the code. */
export class SourceError extends Error {
    constructor(
        readonly code: SourceErrorCode,
        message: string,
        readonly n?: number,
    ) {
        super(message);
    }
}

/** The address as http(s) URL without embedded credentials, or undefined. */
export function parseSourceUrl(raw: unknown): { url: URL; user?: string; password?: string } | undefined {
    if (typeof raw !== 'string') return undefined;
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return undefined;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    url.username = '';
    url.password = '';
    return { url, ...(user ? { user, password } : {}) };
}

/** Key of an address for the status (without credentials). */
export const statusKey = (raw: unknown): string | undefined => parseSourceUrl(raw)?.url.href;

/** Clamp the refresh interval to the allowed range (default 60 s). */
export const intervalOf = (s: { intervalSec?: unknown } | undefined): number => {
    const v = Number(s?.intervalSec ?? DEFAULT_INTERVAL_SEC);
    return Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, Number.isFinite(v) ? v : DEFAULT_INTERVAL_SEC));
};

const statuses = new Map<string, SourceStatus>();
const listeners = new Set<() => void>();

export const getSourceStatus = (raw: unknown): SourceStatus | undefined => {
    const key = statusKey(raw);
    return key ? statuses.get(key) : undefined;
};

/** Called when a status changed (the PI wants to show it). */
export function onSourceStatus(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function setSourceStatus(raw: unknown, status: SourceStatus): void {
    const key = statusKey(raw);
    if (!key) return;
    const before = statuses.get(key);
    statuses.set(key, status);
    // Only a change of the outcome is news; "fetched again" is not worth a push to the PI
    if (before?.ok !== status.ok || before?.code !== status.code || before?.n !== status.n || !before) for (const fn of listeners) fn();
}

const isPicture = (b: Buffer): boolean =>
    (b.length > 2 && b[0] === 0xff && b[1] === 0xd8) || // JPEG
    (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || // PNG
    (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38); // GIF (a weather radar loop, say)

/** Fetch the picture once. Rejects with a SourceError whose text is safe to show. */
export async function fetchPicture(source: PanoramaUrlSource): Promise<Buffer> {
    const parsed = parseSourceUrl(source.url);
    if (!parsed) throw new SourceError('badurl', 'Not a web address (http:// or https://)');
    const user = source.user || parsed.user;
    const password = source.password ?? parsed.password ?? '';
    const headers: Record<string, string> = { accept: 'image/jpeg,image/png,*/*;q=0.5' };
    if (user) headers.authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    let res: Response;
    try {
        res = await fetch(parsed.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    } catch (e) {
        const timedOut = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
        throw new SourceError(timedOut ? 'timeout' : 'connect', timedOut ? 'Timed out' : 'Could not connect');
    }
    if (res.status === 401 || res.status === 403) throw new SourceError('login', `Login failed (${res.status})`, res.status);
    if (!res.ok) throw new SourceError('http', `The camera answered ${res.status}`, res.status);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) throw new SourceError('big', 'The picture is too large (over 15 MB)');
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
            total += chunk.length;
            if (total > MAX_BYTES) throw new SourceError('big', 'The picture is too large (over 15 MB)');
            chunks.push(chunk);
        }
    } catch (e) {
        if (e instanceof SourceError) throw e;
        throw new SourceError('broke', 'The connection broke off');
    }
    const bytes = Buffer.concat(chunks);
    if (!isPicture(bytes)) throw new SourceError('notpicture', 'That address does not give a JPEG, PNG or GIF picture');
    return bytes;
}

/**
 * Keeps one web picture fresh for an effect: the first fetch at once, then every `intervalSec` while
 * ticked (a row that is not on any display is not ticked, so nothing is fetched then). The last good
 * picture stays when a fetch fails.
 */
export class UrlPictureLoader {
    private source: PanoramaUrlSource | undefined;
    private sinceMs = 0;
    private busy = false;
    private latest: Buffer | undefined;
    private generation = 0;
    /** Counts up with every new picture, so the effect knows to rebuild. */
    version = 0;

    get bytes(): Buffer | undefined {
        return this.latest;
    }

    /** Use this source (a changed address, login or interval restarts the loader). */
    set(source: PanoramaUrlSource | undefined): void {
        const same = JSON.stringify([this.source?.url, this.source?.user, this.source?.password]) === JSON.stringify([source?.url, source?.user, source?.password]);
        this.source = source;
        if (same && this.latest) return;
        this.generation++;
        this.latest = undefined;
        this.sinceMs = Infinity;
        this.version++;
    }

    tick(dtMs: number): void {
        const source = this.source;
        if (!source || this.busy) return;
        this.sinceMs += dtMs;
        if (this.sinceMs < intervalOf(source) * 1000) return;
        this.sinceMs = 0;
        this.busy = true;
        const generation = this.generation;
        void fetchPicture(source)
            .then((bytes) => {
                if (generation !== this.generation) return;
                this.latest = bytes;
                this.version++;
                setSourceStatus(source.url, { ok: true, at: Date.now() });
            })
            .catch((e) => {
                if (generation !== this.generation) return;
                const err = e instanceof SourceError ? e : new SourceError('other', 'Could not load the picture');
                setSourceStatus(source.url, { ok: false, at: Date.now(), code: err.code, n: err.n });
                kitLog().warn(`[panorama] web picture: ${err.message}`);
            })
            .finally(() => {
                this.busy = false;
            });
    }
}
