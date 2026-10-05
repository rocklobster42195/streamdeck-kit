import { afterEach, describe, expect, it } from 'vitest';
import { CoverServer } from '../src/render/cover-server.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let server: CoverServer | undefined;
afterEach(() => server?.stop());

describe('CoverServer', () => {
    it('serves an image on 127.0.0.1, keyed by its content', async () => {
        server = new CoverServer();
        const url = await server.add(png.toString('base64'), 'image/png');
        expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/cover\/[0-9a-f]{16}$/);
        const res = await fetch(url!);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        expect(Buffer.from(await res.arrayBuffer()).equals(png)).toBe(true);
        expect(await server.add(png, 'image/png')).toBe(url);
    });

    it('takes an own key, and answers 404 for unknown ones', async () => {
        server = new CoverServer();
        const url = await server.add(png, 'image/png', 'abc');
        expect(url).toMatch(/\/cover\/abc$/);
        expect((await fetch(url!.replace('abc', 'nope'))).status).toBe(404);
        await expect(server.add(png, 'image/png', '../x')).rejects.toThrow(/bad key/);
    });

    it('keeps only the newest covers', async () => {
        server = new CoverServer({ keep: 2 });
        await server.add(png, 'image/png', 'a');
        await server.add(png, 'image/png', 'b');
        await server.add(png, 'image/png', 'a');
        await server.add(png, 'image/png', 'c');
        expect([server.has('a'), server.has('b'), server.has('c')]).toEqual([true, false, true]);
        expect(server.url('b')).toBeUndefined();
    });

    it('calls anything that is not an image a JPEG', async () => {
        server = new CoverServer();
        const res = await fetch((await server.add(png, 'binary/octet-stream'))!);
        expect(res.headers.get('content-type')).toBe('image/jpeg');
    });
});
