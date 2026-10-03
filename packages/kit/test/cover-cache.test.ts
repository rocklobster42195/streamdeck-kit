import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCover } from '../src/render/cover-cache.js';

// Ported from sonos-controller's cover-art-loader tests (hardware lessons).
function jpeg(byte: number): Response {
    return new Response(new Uint8Array([byte]), { status: 200, headers: { 'content-type': 'image/jpeg' } });
}

describe('loadCover', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        vi.useRealTimers();
    });

    it('fetches once and serves repeats from the cache', async () => {
        fetchSpy.mockResolvedValue(jpeg(1));
        const first = await loadCover('http://cache.test/a.jpg');
        const second = await loadCover('http://cache.test/a.jpg');
        expect(first).toMatch(/^data:image\/jpeg;base64,/);
        expect(second).toBe(first);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('dedupes concurrent requests for the same URL', async () => {
        let open!: (r: Response) => void;
        fetchSpy.mockReturnValue(new Promise<Response>((r) => (open = r)));
        const a = loadCover('http://dedupe.test/a.jpg');
        const b = loadCover('http://dedupe.test/a.jpg');
        await Promise.resolve();
        open(jpeg(2));
        expect(await b).toBe(await a);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does not retry a failed URL for a few seconds', async () => {
        fetchSpy.mockResolvedValue(new Response('', { status: 404 }));
        expect(await loadCover('http://fail.test/missing.jpg')).toBeUndefined();
        expect(await loadCover('http://fail.test/missing.jpg')).toBeUndefined();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('treats empty bodies and non-images as failures', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(new Uint8Array([]), { status: 200, headers: { 'content-type': 'image/png' } }));
        expect(await loadCover('http://empty.test/a.png')).toBeUndefined();
        fetchSpy.mockResolvedValueOnce(new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }));
        expect(await loadCover('http://html.test/a.png')).toBeUndefined();
    });

    it('aborts a stuck fetch after the timeout and frees its throttle slot', async () => {
        vi.useFakeTimers();
        fetchSpy.mockImplementation((_url: string | URL | Request, init?: RequestInit) => new Promise((_resolve, reject) => {
            init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        }));
        const stuck = loadCover('http://stuck.test/a.jpg');
        await vi.advanceTimersByTimeAsync(8000);
        await expect(stuck).resolves.toBeUndefined();
        fetchSpy.mockResolvedValue(jpeg(4));
        expect(await loadCover('http://stuck.test/b.jpg')).toMatch(/^data:image\/jpeg;base64,/);
    });
});
