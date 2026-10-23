// The Colour and Image Panorama effects on a row of four dials (800 x 100): a solid colour, a fade, and a
// picture with each fit and with darkening. The picture is drawn here (a harbour at dusk, 4:1).
//   npm run build -w packages/kit && node tools/preview-panorama-backgrounds.mjs <out.png> [picture.jpg | https://camera/snapshot.jpg]
// (needs `sharp`, e.g. from a plugin's node_modules)
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] ?? 'panorama-backgrounds.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');
const load = async (p) => (await import(pathToFileURL(path.resolve('packages/kit/dist/panorama', p)).href));
const { default: colour } = await load('effects/colour/index.js');
const { default: image } = await load('effects/image/index.js');
const store = await load('image-store.js');

store.configurePanoramaStorage({ dir: mkdtempSync(path.join(tmpdir(), 'kit-pano-')) });

const harbour = `<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="800" viewBox="0 0 800 200">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3b5c"/><stop offset=".55" stop-color="#e49a6a"/><stop offset="1" stop-color="#f3c78d"/></linearGradient></defs>
<rect width="800" height="200" fill="url(#s)"/><circle cx="560" cy="100" r="26" fill="#fbe3b0"/>
<path d="M0 124 L60 96 L120 116 L210 76 L300 120 L380 100 L470 128 L560 88 L650 120 L730 92 L800 116 L800 148 L0 148 Z" fill="#46506b"/>
<path d="M0 144 L800 144 L800 200 L0 200 Z" fill="#1c2a44"/>
<g fill="#10192b"><rect x="90" y="104" width="6" height="44"/><rect x="208" y="116" width="4" height="32"/><rect x="330" y="100" width="6" height="48"/><rect x="620" y="106" width="6" height="42"/></g>
<g stroke="#f3c78d" stroke-opacity=".35" stroke-width="2"><path d="M0 160 H800"/><path d="M0 176 H800" stroke-opacity=".2"/></g></svg>`;
const arg = process.argv[3];
// A web address goes through the kit's own fetch (the same code the effect uses for a webcam)
const { fetchPicture } = await load('image-source.js');
const given = !arg ? undefined : /^https?:/.test(arg) ? await fetchPicture({ kind: 'url', url: arg }) : readFileSync(path.resolve(arg));
const bytes = given ?? (await sharp(Buffer.from(harbour)).jpeg({ quality: 92 }).toBuffer());
const id = '0123456789abcdef';
store.saveImage(id, bytes);
const source = { kind: 'file', id, name: 'picture.jpg', w: 0, h: 0 };

const W = 800, H = 100;
const rows = [
    ['Colour, fixed', colour, { color: '#2F4A3A' }],
    ['Colour, fade 60 %', colour, { color: '#2F4A3A', fade: true, fadeAmount: 60 }],
    ['Image, fill', image, { source, fit: 'fill' }],
    ['Image, fill, top (posY 0)', image, { source, fit: 'fill', posY: 0 }],
    ['Image, fill, bottom (posY 100)', image, { source, fit: 'fill', posY: 100 }],
    ['Image, fit', image, { source, fit: 'fit' }],
    ['Image, stretch', image, { source, fit: 'stretch' }],
    ['Image, fill, darken 50 %', image, { source, fit: 'fill', dim: 50 }],
];

// A volume ring and a name on every dial but the last, with a soft disc or without
const ring = (cx, scrim) => `${scrim ? `<circle cx="${cx}" cy="50" r="30" fill="#000" opacity=".45"/>` : ''}<circle cx="${cx}" cy="50" r="22" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5"/><path d="M${cx} 28 A22 22 0 1 1 ${cx - 15.5} 65.5" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><text x="${cx}" y="55" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="14">42</text>`;

const gap = 10, label = 18;
let y = 0;
let body = '';
for (const [name, def, settings] of rows) {
    const inst = def.createInstance();
    inst.initPanorama({ width: W, height: H, settings });
    inst.tickPanorama(1000);
    let strip = '';
    for (let i = 0; i < 4; i++) {
        strip += `<g transform="translate(${i * 200} 0)"><rect width="200" height="100" fill="#000"/>${inst.renderSlice(i * 200, 200, 100)}</g>`;
    }
    const withRings = [0, 1, 2].map((i) => ring(i * 200 + 100, false)).join('');
    body += `<text x="0" y="${y + 13}" fill="#ccc" font-family="sans-serif" font-size="13">${name}</text><g transform="translate(0 ${y + label})">${strip}${withRings}</g>`;
    y += label + H + gap;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="#1c1c1e"/>${body}</svg>`;
await sharp(Buffer.from(svg)).resize(W * 2, y * 2, { kernel: 'lanczos3' }).png().toFile(out);
console.log('wrote', out);
