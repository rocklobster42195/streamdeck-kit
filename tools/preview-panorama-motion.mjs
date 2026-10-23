// Ken Burns (zoom and pan) and an animated GIF on a row of four dials, as stills at a few moments, and
// what one step costs on four and six dials.
//   npm run build -w packages/kit && node tools/preview-panorama-motion.mjs <out.png> [picture.jpg | https://camera/snapshot.jpg]
// (needs `sharp`, e.g. from a plugin's node_modules)
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] ?? 'panorama-motion.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');
const omggif = createRequire(path.resolve('packages/kit/package.json'))('omggif');
const load = async (p) => import(pathToFileURL(path.resolve('packages/kit/dist/panorama', p)).href);
const { default: image } = await load('effects/image/index.js');
const store = await load('image-store.js');
const { fetchPicture } = await load('image-source.js');
store.configurePanoramaStorage({ dir: mkdtempSync(path.join(tmpdir(), 'kit-pano-')) });

const arg = process.argv[3];
const photo = !arg ? undefined : /^https?:/.test(arg) ? await fetchPicture({ kind: 'url', url: arg }) : readFileSync(path.resolve(arg));
if (!photo) throw new Error('give a picture (a file or an address)');
store.saveImage('0123456789abcdef', photo);

// An invented GIF: a bright bar running over a blue gradient, 12 frames, 2.4 s
const GW = 160, GH = 20, FRAMES = 12;
const palette = Array.from({ length: 16 }, (_, i) => (20 + i * 4) * 65536 * 0 + (i * 6 << 8) + (80 + i * 10)).concat([0xffffff]);
const buf = Buffer.alloc(GW * GH * FRAMES * 2 + 4096);
const writer = new omggif.GifWriter(buf, GW, GH, { palette: palette.concat(Array(256 - palette.length).fill(0)).slice(0, 256), loop: 0 });
for (let f = 0; f < FRAMES; f++) {
    const px = new Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) px[y * GW + x] = Math.abs(x - (f * GW) / FRAMES - 8) < 8 ? 16 : Math.min(15, Math.floor((x / GW) * 16));
    writer.addFrame(0, 0, GW, GH, px, { delay: 20 });
}
store.saveImage('fedcba9876543210', buf.subarray(0, writer.end()));

const W = 800, H = 100;
const file = (id, name) => ({ kind: 'file', id, name, w: 0, h: 0 });
const photoSource = file('0123456789abcdef', 'photo');
const SEC = 60;
const rows = [];
const make = (settings, width = W) => {
    const e = image.createInstance();
    e.initPanorama({ width, height: H, settings: { source: photoSource, fit: 'fill', ...settings } });
    return e;
};
for (const [name, motion] of [['Ken Burns, zoom', 'zoom'], ['Ken Burns, pan', 'pan']]) {
    for (const frac of [0, 0.25, 0.5]) {
        const e = make({ motion, motionSeconds: SEC });
        if (frac) e.tickPanorama(frac * SEC * 1000);
        rows.push([`${name}, ${Math.round(frac * 100)} % of the cycle`, e]);
    }
}
for (const f of [0, 3, 6, 9]) {
    const e = image.createInstance();
    e.initPanorama({ width: W, height: H, settings: { source: file('fedcba9876543210', 'bar.gif'), fit: 'stretch' } });
    if (f) e.tickPanorama(f * 200);
    rows.push([`GIF, frame ${f + 1} of ${FRAMES}`, e]);
}

const ring = (cx) => `<circle cx="${cx}" cy="50" r="22" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5"/><path d="M${cx} 28 A22 22 0 1 1 ${cx - 15.5} 65.5" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><text x="${cx}" y="55" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="14">42</text>`;
const gap = 10, label = 18;
let y = 0, body = '';
for (const [name, inst] of rows) {
    let strip = '';
    for (let i = 0; i < 4; i++) strip += `<g transform="translate(${i * 200} 0)"><rect width="200" height="100" fill="#000"/>${inst.renderSlice(i * 200, 200, 100)}</g>`;
    body += `<text x="0" y="${y + 13}" fill="#ccc" font-family="sans-serif" font-size="13">${name}</text><g transform="translate(0 ${y + label})">${strip}${[0, 1, 2].map((i) => ring(i * 200 + 100)).join('')}</g>`;
    y += label + H + gap;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="#1c1c1e"/>${body}</svg>`;
await sharp(Buffer.from(svg)).resize(W * 2, y * 2, { kernel: 'lanczos3' }).png().toFile(out);
console.log('wrote', out);

// What one step costs (the work a tick does every 400 ms for a zoom, 100 ms for a GIF)
const time = (fn, n) => {
    fn();
    const t = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn();
    return Number(process.hrtime.bigint() - t) / 1e6 / n;
};
for (const dials of [4, 6]) {
    const width = dials * 200;
    const zoom = make({ motion: 'zoom', motionSeconds: SEC }, width);
    const msZoom = time(() => zoom.tickPanorama(400), 20);
    const t0 = process.hrtime.bigint();
    const gifE = image.createInstance();
    gifE.initPanorama({ width, height: H, settings: { source: file('fedcba9876543210', 'bar.gif'), fit: 'stretch' } });
    const msGifBuild = Number(process.hrtime.bigint() - t0) / 1e6;
    const msGif = time(() => gifE.tickPanorama(100), 200);
    console.log(`${dials} dials: zoom step ${msZoom.toFixed(1)} ms (every 400 ms = ${((msZoom / 400) * 100).toFixed(1)} % of a core) · GIF build ${msGifBuild.toFixed(0)} ms once (${FRAMES} frames) · GIF step ${msGif.toFixed(2)} ms`);
}
