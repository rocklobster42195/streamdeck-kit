// Preview sheet of the universal Track dial: SO-C's dial as published (geometry copied from
// track-control-dial.ts) against the kit's renderer. Run `npm run build` first.
//   node tools/preview-track-dial.mjs <out.png>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { renderTrackDial } from '../packages/kit/dist/index.js';

const out = path.resolve(process.argv[2] ?? 'track-dial-preview.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');

const cover = async (a, b, c) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="288" height="288" fill="url(#g)"/><circle cx="190" cy="100" r="60" fill="#fff" opacity="0.18"/><circle cx="80" cy="210" r="70" fill="${c}" opacity="0.5"/></svg>`;
    return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')}`;
};
const red = await cover('#ff6a3d', '#c2185b', '#4a148c');
const teal = await cover('#00897b', '#26c6da', '#e0f7fa');

const effect = (hue) => {
    const dots = [];
    for (let i = 0; i < 26; i++) {
        const x = (i * 83) % 200, y = (i * 47) % 100, r = 3 + (i % 5) * 2;
        dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${hue + (i % 4) * 8} 80% 55%)" opacity="${0.35 + (i % 3) * 0.2}"/>`);
    }
    return `<rect width="200" height="100" fill="#10141c"/>${dots.join('')}`;
};
const bars = [8, 14, 10, 18, 6, 12, 16, 8, 14, 10];

// SO-C 0.4.10's dial: text left, cover right
const soOld = ({ title, artist, cover: c, eq, progress, accent, pano }) => {
    const textW = 84, x = 8;
    const yT = eq ? 22 : 72, yA = eq ? 38 : 86, yP = eq ? 48 : 95;
    const bg = pano ? `<rect width="200" height="100" fill="#000"/>${pano}` : '<rect width="200" height="100" fill="black"/>';
    const pill = pano ? `<rect x="5" y="${yT - 12}" width="${Math.min(90, title.length * 7.5)}" height="15" fill="black" opacity="0.55" rx="3"/><rect x="5" y="77" width="${Math.min(90, artist.length * 6)}" height="13" fill="black" opacity="0.55" rx="3"/>` : '';
    const eqBars = eq && !pano ? bars.map((h, i) => `<rect x="${8 + i * 9}" y="${90 - h}" width="7" height="${h}" fill="${accent}" opacity="0.75" rx="1"/>`).join('') : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">${bg}${pill}<text x="${x}" y="${yT}" fill="#fff" font-family="Arial" font-size="14">${title}</text><text x="${x}" y="${yA}" fill="#999" font-family="Arial" font-size="${eq ? 12 : 11}">${artist}</text><rect x="${x}" y="${yP}" width="${textW}" height="5" fill="#fff" opacity="0.12" rx="2.5"/><rect x="${x}" y="${yP}" width="${Math.round(textW * progress)}" height="5" fill="${accent}" opacity="0.9" rx="2.5"/>${eqBars}<image href="${c}" x="100" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/></svg>`;
};

const data = (u) => Buffer.from(u.split(',')[1], 'base64').toString();
const kit = (v) => data(renderTrackDial({ nothing: 'Nichts läuft', ...v })).replace(/ id="strip"/g, '');
const base = { title: 'Erfundener Song', artist: 'Sim Artist', cover: red, playing: true, accent: '#ffb199' };
const cases = [
    ['Info, Cover rechts', { ...base, progress: 0.4, look: 'info' }, { title: 'Erfundener Song', artist: 'Sim Artist', cover: red, progress: 0.4, accent: '#ffb199' }],
    ['Info, Cover links', { ...base, progress: 0.4, coverSide: 'left' }, null],
    ['Equalizer', { ...base, progress: 0.4, look: 'eq', bars }, { title: 'Erfundener Song', artist: 'Sim Artist', cover: red, progress: 0.4, accent: '#ffb199', eq: true }],
    ['Pause', { ...base, progress: 0.4, playing: false }, null],
    ['Radio (LIVE)', { title: 'Sender Eins', artist: 'Nachrichten', cover: teal, playing: true, live: true, accent: '#80deea' }, null],
    ['Panorama, Info', { ...base, progress: 0.7, underlay: effect(200) }, { title: 'Erfundener Song', artist: 'Sim Artist', cover: red, progress: 0.7, accent: '#ffb199', pano: effect(200) }],
    ['Nichts läuft', { playing: false, accent: '#ccc' }, null],
];

const S = 1.3, cw = 200 * S, ch = 100 * S, pad = 12, rowLabel = 22, head = 24;
const rows = [
    ['SO-C 0.4.10 (heute)', (c) => (c[2] ? soOld(c[2]) : null)],
    ['Kit-Renderer (Vorschlag)', (c) => kit(c[1])],
];
const cols = 4;
const parts = [];
let y = pad;
for (let g = 0; g < cases.length; g += cols) {
    const group = cases.slice(g, g + cols);
    group.forEach((c, i) => parts.push(`<text x="${pad + i * (cw + pad) + cw / 2}" y="${y + 16}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="13" fill="#ddd">${c[0]}</text>`));
    y += head;
    for (const [rowName, draw] of rows) {
        parts.push(`<text x="${pad}" y="${y + 14}" font-family="Segoe UI, Arial" font-size="11" fill="#8a8a90">${rowName}</text>`);
        y += rowLabel - 6;
        group.forEach((c, i) => {
            const svg = draw(c);
            if (!svg) return;
            const x = pad + i * (cw + pad);
            const inner = svg.replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/id="strip"/g, '').replace(/url\(#strip\)/g, '');
            parts.push(`<g transform="translate(${x} ${y}) scale(${S})"><svg width="200" height="100" viewBox="0 0 200 100">${inner}</svg></g>`);
        });
        y += ch + 8;
    }
    y += 10;
}
const W = pad + cols * (cw + pad), H = y + pad;
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1b1f"/>${parts.join('')}</svg>`)).png().toFile(out);
console.log(out);
