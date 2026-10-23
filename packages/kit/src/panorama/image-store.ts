// Pictures for the Image effect: a file picked in the PI is sent to the plugin in chunks and kept in a
// folder outside the plugin (an update replaces the plugin folder), shared by every plugin of the family.
// The row settings hold only a small reference ({kind:'file', id, name, w, h}), never the bytes.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, utimesSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { kitLog } from '../log.js';

/** What the row settings hold for a picture from a file. */
export type PanoramaFileSource = { kind: 'file'; id: string; name: string; w: number; h: number };
export type PanoramaSource = PanoramaFileSource | { kind: 'none' };

const ID = /^[0-9a-f]{16,32}$/;
/** A picture the PI sends is at most this big (the PI scales it down first, ~4000 px wide). */
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_CHUNKS = 64;

function defaultDir(): string {
    if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'streamdeck-kit', 'panorama-images');
    if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'streamdeck-kit', 'panorama-images');
    return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'streamdeck-kit', 'panorama-images');
}

let dir = defaultDir();

/** Where the pictures live (default: the user's app data folder, shared by the plugins of the family). */
export function configurePanoramaStorage(o: { dir?: string }): void {
    if (o.dir) dir = o.dir;
}

export const isImageId = (id: unknown): id is string => typeof id === 'string' && ID.test(id);

const fileOf = (id: string) => join(dir, `${id}.img`);

/** Pictures that were read in this run (a read marks the file as in use, once is enough). */
const touched = new Set<string>();

/** The stored bytes of a picture, or undefined (unknown id, not complete yet). */
export function readImage(id: string): Buffer | undefined {
    if (!isImageId(id)) return undefined;
    try {
        if (!existsSync(fileOf(id))) return undefined;
        const bytes = readFileSync(fileOf(id));
        // The clean-up goes by the file's age, so every plugin that shows the picture keeps it young
        if (!touched.has(id)) {
            touched.add(id);
            const now = new Date();
            utimesSync(fileOf(id), now, now);
        }
        return bytes;
    } catch {
        return undefined;
    }
}

export function saveImage(id: string, bytes: Buffer): boolean {
    if (!isImageId(id) || bytes.length === 0 || bytes.length > MAX_BYTES) return false;
    try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(fileOf(id), new Uint8Array(bytes));
        return true;
    } catch (e) {
        kitLog().warn('[panorama] could not store a picture', e);
        return false;
    }
}

/**
 * Delete pictures nobody refers to (`keep`) that no plugin has shown for `maxAgeDays` (a read touches
 * the file). The folder is shared by the plugins of the family, and one of them may not be running
 * for weeks, so the time is long.
 */
export function sweepImages(keep: Set<string>, maxAgeDays = 90): void {
    try {
        if (!existsSync(dir)) return;
        const limit = Date.now() - maxAgeDays * 86_400_000;
        for (const name of readdirSync(dir)) {
            const id = name.replace(/\.img$/, '');
            if (!isImageId(id) || keep.has(id)) continue;
            const file = join(dir, name);
            if (statSync(file).mtimeMs < limit) unlinkSync(file);
        }
    } catch (e) {
        kitLog().warn('[panorama] picture clean-up failed', e);
    }
}

type Pending = { parts: (Buffer | undefined)[]; bytes: number; at: number };
const pending = new Map<string, Pending>();

/**
 * One chunk of a picture from the PI ("panorama-image-chunk": id, index, total, base64 data). The
 * picture is written when the last chunk is in; returns true then.
 */
export function receiveImageChunk(msg: Record<string, unknown>): boolean {
    const { id, index, total, data } = msg;
    if (!isImageId(id) || typeof data !== 'string' || !Number.isInteger(index) || !Number.isInteger(total)) return false;
    const i = index as number;
    const n = total as number;
    if (n < 1 || n > MAX_CHUNKS || i < 0 || i >= n) return false;
    // Chunks that never completed are forgotten after a minute
    const now = Date.now();
    for (const [key, p] of pending) if (now - p.at > 60_000) pending.delete(key);
    const entry = pending.get(id) ?? { parts: new Array<Buffer | undefined>(n).fill(undefined), bytes: 0, at: now };
    if (entry.parts.length !== n) return false;
    const part = Buffer.from(data, 'base64');
    entry.bytes += part.length - (entry.parts[i]?.length ?? 0);
    if (entry.bytes > MAX_BYTES) {
        pending.delete(id);
        return false;
    }
    entry.parts[i] = part;
    entry.at = now;
    pending.set(id, entry);
    if (entry.parts.some((x) => !x)) return false;
    pending.delete(id);
    return saveImage(id, Buffer.concat(entry.parts as unknown as Uint8Array[]));
}
