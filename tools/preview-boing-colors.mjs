// Boing Ball and Boing Globe in a few cover colours, one 200 x 100 panel each (a pale one, a blue
// one, the default green), to check that the checker and the land stay readable.
//   node tools/preview-boing-colors.mjs <out.png>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve(process.argv[2] ?? 'boing-colors.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');
const { default: ball } = await import(pathToFileURL(path.resolve('packages/kit/dist/panorama/effects/boing-ball/index.js')).href);
const { default: globe } = await import(pathToFileURL(path.resolve('packages/kit/dist/panorama/effects/boing-globe/index.js')).href);

const COLORS = ['#F4F4F0', '#2A4E80', '#87AE73', '#C0392B'];
const W = 200, H = 100;
const panels = [];
for (const [def, key] of [[ball, 'primaryColor'], [globe, 'landColor']]) {
    for (const color of COLORS) {
        const inst = def.createInstance();
        inst.initPanorama({ width: W, height: H, settings: { [key]: color } });
        // Roll the effect on a few ticks so it is not at the first pose
        for (let i = 0; i < 11; i++) inst.tickPanorama();
        panels.push(`<rect width="${W}" height="${H}" fill="#000"/>${inst.renderSlice(0, W, H)}`);
    }
}
const cols = COLORS.length;
const gap = 4;
const sheetW = cols * W + (cols - 1) * gap, sheetH = 2 * H + gap;
const body = panels.map((p, i) => `<g transform="translate(${(i % cols) * (W + gap)} ${Math.floor(i / cols) * (H + gap)})">${p}</g>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}"><rect width="100%" height="100%" fill="#222"/>${body}</svg>`;
await sharp(Buffer.from(svg)).resize(sheetW * 2, sheetH * 2, { kernel: 'lanczos3' }).png().toFile(out);
console.log('wrote', out);
