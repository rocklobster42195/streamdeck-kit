// Covers a plugin only has as bytes (Windows' media sessions; later images behind a login, such as
// Home Assistant's entity pictures) as URLs every plugin on this computer can load: loadCover() and
// deckbus players carry URLs, so the plugin serves them itself, on 127.0.0.1 and a port the system
// picks. In memory; the newest few stay. First used by SA-C (grill 2026-10-05).
import { createHash } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

type Entry = { type: string; bytes: Buffer };

export class CoverServer {
    private readonly covers = new Map<string, Entry>();
    private readonly keep: number;
    private readonly log: { warn(m: string): void };
    private server: http.Server | undefined;
    private port = 0;
    private starting: Promise<void> | undefined;

    /** `keep`: how many covers stay (a few tracks back, for keys that still show the last one). */
    constructor(o: { keep?: number; log?: { warn(m: string): void } } = {}) {
        this.keep = o.keep ?? 16;
        this.log = o.log ?? console;
    }

    /**
     * Adds an image (bytes or base64) and returns its URL; serving starts with the first one.
     * `key` names it (default: from its content, so the same image gets the same URL).
     * Undefined when the server can't start.
     */
    async add(data: Buffer | string, type: string, key?: string): Promise<string | undefined> {
        const bytes = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
        const k = key ?? CoverServer.keyOf(bytes);
        if (!/^[0-9A-Za-z_-]+$/.test(k)) throw new Error(`CoverServer: bad key ${k}`);
        this.covers.delete(k);
        this.covers.set(k, { type: type.startsWith('image/') ? type : 'image/jpeg', bytes });
        while (this.covers.size > this.keep) this.covers.delete(this.covers.keys().next().value!);
        await this.start();
        return this.url(k);
    }

    has(key: string | undefined): boolean {
        return !!key && this.covers.has(key);
    }

    /** The cover's URL, while the server runs and keeps it. */
    url(key: string | undefined): string | undefined {
        return key && this.port && this.covers.has(key) ? `http://127.0.0.1:${this.port}/cover/${key}` : undefined;
    }

    stop(): void {
        this.server?.close();
        this.server = undefined;
        this.starting = undefined;
        this.port = 0;
    }

    /** A key from an image's content (16 hex digits). */
    static keyOf(bytes: Buffer): string {
        return createHash('sha1').update(new Uint8Array(bytes)).digest('hex').slice(0, 16);
    }

    private start(): Promise<void> {
        this.starting ??= new Promise<void>((resolve) => {
            const server = http.createServer((req, res) => {
                const key = /^\/cover\/([0-9A-Za-z_-]+)$/.exec(req.url ?? '')?.[1];
                const cover = key ? this.covers.get(key) : undefined;
                if (req.method !== 'GET' || !cover) {
                    res.writeHead(404).end();
                    return;
                }
                // A key names one image, so it never changes
                res.writeHead(200, { 'content-type': cover.type, 'content-length': cover.bytes.length, 'cache-control': 'max-age=86400, immutable' });
                res.end(cover.bytes);
            });
            server.on('error', (e) => {
                this.log.warn(`[covers] ${e.message}`);
                resolve();
            });
            server.listen(0, '127.0.0.1', () => {
                this.port = (server.address() as AddressInfo).port;
                resolve();
            });
            // Never keeps the plugin's process alive by itself
            server.unref();
            this.server = server;
        });
        return this.starting;
    }
}
