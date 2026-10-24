import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jpeg from 'jpeg-js';
import omggif from 'omggif';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import image from '../src/panorama/effects/image/index.js';
import { fetchPicture, getSourceStatus, SourceError, intervalOf, parseSourceUrl, setSourceStatus, UrlPictureLoader } from '../src/panorama/image-source.js';
import { withoutLogin } from '../src/panorama/rows.js';

/** Waits until `cond` holds (a fetch on a slow runner takes longer than any fixed pause). */
const until = async (cond: () => boolean, ms = 4000): Promise<void> => {
    const end = Date.now() + ms;
    while (!cond() && Date.now() < end) await new Promise((ok) => setTimeout(ok, 10));
};

function picture(w = 400, h = 100): Buffer {
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 200;
        data[i + 1] = 120;
        data[i + 2] = 40;
        data[i + 3] = 255;
    }
    return Buffer.from(jpeg.encode({ data, width: w, height: h }, 90).data);
}

/** A small animated GIF: three solid frames. */
function animation(): Buffer {
    const buf = Buffer.alloc(4096);
    const w = new omggif.GifWriter(buf, 8, 8, { palette: [0xff0000, 0x00ff00, 0x0000ff, 0xffffff], loop: 0 });
    for (let i = 0; i < 3; i++) w.addFrame(0, 0, 8, 8, new Array(64).fill(i), { delay: 10 });
    return buf.subarray(0, w.end());
}

let server: http.Server;
let base = '';
const hits: Record<string, number> = {};
const seenAuth: (string | undefined)[] = [];

beforeAll(async () => {
    server = http.createServer((req, res) => {
        hits[req.url ?? ''] = (hits[req.url ?? ''] ?? 0) + 1;
        if (req.url === '/snap.jpg') {
            seenAuth.push(req.headers.authorization);
            if (req.headers.authorization !== `Basic ${Buffer.from('viewer:secret').toString('base64')}`) return void res.writeHead(401).end();
            return void res.writeHead(200, { 'content-type': 'image/jpeg' }).end(picture());
        }
        if (req.url === '/open.jpg' || req.url === '/loop.jpg') return void res.writeHead(200, { 'content-type': 'image/jpeg' }).end(picture());
        if (req.url === '/anim.gif') return void res.writeHead(200, { 'content-type': 'image/gif' }).end(animation());
        if (req.url === '/page.html') return void res.writeHead(200, { 'content-type': 'text/html' }).end('<html>hello</html>');
        if (req.url === '/huge.jpg') {
            res.writeHead(200, { 'content-length': String(40 * 1024 * 1024) });
            return void res.destroy();
        }
        if (req.url === '/redirect.jpg') return void res.writeHead(302, { location: '/open.jpg' }).end();
        res.writeHead(404).end();
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

describe('web address', () => {
    it('takes only http(s) and moves a login out of the address', () => {
        expect(parseSourceUrl('ftp://cam/x.jpg')).toBeUndefined();
        expect(parseSourceUrl('file:///etc/passwd')).toBeUndefined();
        expect(parseSourceUrl('not a url')).toBeUndefined();
        const p = parseSourceUrl('http://viewer:se%20cret@cam.local/snap.jpg')!;
        expect(p.url.href).toBe('http://cam.local/snap.jpg');
        expect(p.user).toBe('viewer');
        expect(p.password).toBe('se cret');
    });

    it('keeps the refresh interval between 10 s and 10 min, 60 s by default', () => {
        expect(intervalOf(undefined)).toBe(60);
        expect(intervalOf({ intervalSec: 1 })).toBe(10);
        expect(intervalOf({ intervalSec: 99999 })).toBe(600);
        expect(intervalOf({ intervalSec: 'x' })).toBe(60);
    });
});

describe('fetching a picture', () => {
    it('sends the login as Basic auth and returns the picture', async () => {
        const bytes = await fetchPicture({ kind: 'url', url: `${base}/snap.jpg`, user: 'viewer', password: 'secret' });
        expect(bytes[0]).toBe(0xff);
        expect(seenAuth.at(-1)).toBe(`Basic ${Buffer.from('viewer:secret').toString('base64')}`);
    });

    it('also takes the login from the address', async () => {
        const url = base.replace('http://', 'http://viewer:secret@') + '/snap.jpg';
        expect((await fetchPicture({ kind: 'url', url })).length).toBeGreaterThan(100);
    });

    it('follows a redirect on the same server', async () => {
        expect((await fetchPicture({ kind: 'url', url: `${base}/redirect.jpg` })).length).toBeGreaterThan(100);
    });

    it('says what went wrong without the address or the login', async () => {
        const fail = async (source: Parameters<typeof fetchPicture>[0]) => fetchPicture(source).then(() => '', (e: Error) => e.message);
        const code = async (source: Parameters<typeof fetchPicture>[0]) => fetchPicture(source).then(() => '', (e: SourceError) => `${e.code}${e.n ? ':' + e.n : ''}`);
        expect(await fail({ kind: 'url', url: `${base}/snap.jpg`, user: 'viewer', password: 'wrong' })).toBe('Login failed (401)');
        expect(await fail({ kind: 'url', url: `${base}/page.html` })).toMatch(/JPEG, PNG or GIF/);
        expect(await fail({ kind: 'url', url: `${base}/missing.jpg` })).toBe('The camera answered 404');
        expect(await fail({ kind: 'url', url: `${base}/huge.jpg` })).toMatch(/too large|connection broke|connect/i);
        expect(await fail({ kind: 'url', url: 'http://127.0.0.1:1/x.jpg' })).toBe('Could not connect');
        expect(await fail({ kind: 'url', url: 'ftp://x' })).toMatch(/web address/);
        // The PI shows these in the user's language, from the code
        expect(await code({ kind: 'url', url: `${base}/snap.jpg`, user: 'viewer', password: 'wrong' })).toBe('login:401');
        expect(await code({ kind: 'url', url: `${base}/missing.jpg` })).toBe('http:404');
        expect(await code({ kind: 'url', url: `${base}/page.html` })).toBe('notpicture');
        expect(await code({ kind: 'url', url: 'http://127.0.0.1:1/x.jpg' })).toBe('connect');
        expect(await code({ kind: 'url', url: 'ftp://x' })).toBe('badurl');
        expect(await fail({ kind: 'url', url: `${base}/snap.jpg`, user: 'viewer', password: 'wrong' })).not.toContain('wrong');
    });
});

describe('loader', () => {
    const settle = () => new Promise((ok) => setTimeout(ok, 80));

    it('fetches at once, then only when the interval is over, and keeps the last picture on a failure', async () => {
        const url = `${base}/loop.jpg`;
        const loader = new UrlPictureLoader();
        loader.set({ kind: 'url', url, intervalSec: 10 });
        loader.tick(0);
        await until(() => !!loader.bytes);
        expect(hits['/loop.jpg']).toBe(1);
        expect(loader.bytes).toBeDefined();
        expect(getSourceStatus(url)?.ok).toBe(true);
        const v = loader.version;
        loader.tick(5000);
        await settle();
        expect(hits['/loop.jpg']).toBe(1);
        loader.tick(5000);
        await until(() => loader.version > v);
        expect(hits['/loop.jpg']).toBe(2);
        expect(loader.version).toBeGreaterThan(v);
        // The same address again: nothing restarts
        loader.set({ kind: 'url', url, intervalSec: 10 });
        expect(loader.bytes).toBeDefined();
        // The camera goes away: the last picture stays, the status says why
        const gone = new UrlPictureLoader();
        gone.set({ kind: 'url', url: `${base}/snap.jpg`, user: 'viewer', password: 'secret', intervalSec: 10 });
        gone.tick(0);
        await until(() => !!gone.bytes);
        const had = gone.bytes;
        expect(had).toBeDefined();
        gone.set({ kind: 'url', url: `${base}/snap.jpg`, user: 'viewer', password: 'secret', intervalSec: 10 });
        setSourceStatus(`${base}/snap.jpg`, { ok: false, at: Date.now(), code: 'timeout' });
        expect(getSourceStatus(`${base}/snap.jpg`)?.code).toBe('timeout');
        expect(gone.bytes).toBe(had);
    });

    it('lets go of the old picture when the address changes', async () => {
        const loader = new UrlPictureLoader();
        loader.set({ kind: 'url', url: `${base}/open.jpg` });
        loader.tick(0);
        await until(() => !!loader.bytes);
        expect(loader.bytes).toBeDefined();
        loader.set({ kind: 'url', url: `${base}/page.html` });
        expect(loader.bytes).toBeUndefined();
    });
});

describe('image effect with a web address', () => {
    it('plays a GIF from a web address too (a radar loop, say)', async () => {
        expect((await fetchPicture({ kind: 'url', url: `${base}/anim.gif` })).subarray(0, 3).toString()).toBe('GIF');
        const effect = image.createInstance();
        effect.initPanorama({ width: 200, height: 100, settings: { source: { kind: 'url' as const, url: `${base}/anim.gif`, intervalSec: 10 }, fit: 'stretch' as const } });
        await until(() => {
            effect.tickPanorama(0);
            return effect.renderSlice(0, 200, 100).includes('data:image');
        });
        effect.tickPanorama(1000);
        const a = effect.renderSlice(0, 200, 100);
        effect.tickPanorama(100);
        expect(effect.renderSlice(0, 200, 100)).not.toBe(a);
        effect.destroy?.();
    });

    it('shows the picture once it has been fetched and leaves it standing when the next fetch fails', async () => {
        const effect = image.createInstance();
        const settings = { source: { kind: 'url' as const, url: `${base}/open.jpg`, intervalSec: 10 }, fit: 'fill' as const };
        effect.initPanorama({ width: 400, height: 100, settings });
        expect(effect.renderSlice(0, 200, 100)).not.toContain('<image');
        await until(() => {
            effect.tickPanorama(0);
            return effect.renderSlice(0, 200, 100).includes('data:image');
        });
        effect.tickPanorama(1000);
        expect(effect.renderSlice(0, 200, 100)).toContain('<image href="data:image/jpeg;base64,');
        expect(effect.renderSlice(200, 200, 100)).toContain('<image');
        // A different address with nothing behind it: the old picture is not shown for it
        effect.onSettingsChange({ source: { kind: 'url', url: `${base}/page.html` } });
        expect(effect.renderSlice(0, 200, 100)).not.toContain('<image');
        effect.destroy?.();
    });
});

describe('row on the bus', () => {
    it('leaves a web picture\'s user and password out, and everything else as it is', () => {
        const row = { effect: 'image', stamp: 1, settings: { source: { kind: 'url', url: 'http://cam/x.jpg', user: 'viewer', password: 'secret', intervalSec: 30 }, dim: 20 } };
        const out = withoutLogin(row as never);
        expect(out.settings.source).toEqual({ kind: 'url', url: 'http://cam/x.jpg', intervalSec: 30 });
        expect(out.settings.dim).toBe(20);
        expect(JSON.stringify(row)).toContain('secret'); // the original is untouched
        const file = { effect: 'image', stamp: 1, settings: { source: { kind: 'file', id: 'a1b2c3d4e5f60718' } } };
        expect(withoutLogin(file as never)).toBe(file);
    });
});
