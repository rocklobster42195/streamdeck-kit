// Preview sheet of the universal Play/Pause key from the kit's own renderer (run `npm run build`
// first): the states it shows and the corner choices. Invented covers (gradients), no real art.
//   node tools/preview-play-pause.mjs <out.png>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { mdiSofa } from '@mdi/js';
import { SONOS_TITLE_FADER, TitleFader, batteryBadge, renderPlayPauseKey } from '../packages/kit/dist/index.js';

const out = path.resolve(process.argv[2] ?? 'play-pause-preview.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');

const cover = async (a, b, c) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="288" height="288" fill="url(#g)"/><circle cx="190" cy="100" r="60" fill="#fff" opacity="0.18"/><circle cx="80" cy="210" r="70" fill="${c}" opacity="0.5"/></svg>`;
    return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')}`;
};
const title = (text, steps = 14) => {
    const f = new TitleFader(text, SONOS_TITLE_FADER);
    for (let i = 0; i < steps; i++) f.step();
    return f.svg();
};
const sourceIcon = async () => `data:image/png;base64,${(await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="22" fill="#1db954"/><path transform="translate(10 10) scale(1)" fill="#101010" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z"/></svg>')).png().toBuffer()).toString('base64')}`;

const red = await cover('#ff6a3d', '#c2185b', '#4a148c');
const teal = await cover('#00897b', '#26c6da', '#e0f7fa');
const orange = await cover('#f9a825', '#ef6c00', '#3e2723');
const src = { kind: 'image', href: await sourceIcon() };
const marker = { kind: 'icon', path: mdiSofa, color: '#b8b8be' };

const keys = [
    ['spielt', { playing: true, cover: red, iconColor: '#ccc', accent: '#ffb199', progress: 0.4, titleSvg: title('Erfundener Song [Sim Artist]'), left: marker, right: src }],
    ['Pause', { playing: false, cover: red, iconColor: '#ccc', accent: '#ffb199', progress: 0.4, titleSvg: title('Erfundener Song [Sim Artist]'), left: marker, right: src }],
    ['Radio, nur Quelle', { playing: true, cover: teal, iconColor: '#ccc', accent: '#80deea', titleSvg: title('Sender Eins'), left: undefined, right: src }],
    ['Akku rechts', { playing: true, cover: orange, iconColor: '#ccc', accent: '#ffd180', progress: 0.2, left: marker, right: batteryBadge(15, false, 'low') }],
    ['Akku immer', { playing: true, cover: orange, iconColor: '#ccc', accent: '#ffd180', progress: 0.7, left: src, right: batteryBadge(64, true, 'always') }],
    ['ohne Cover, Farbe', { playing: false, iconColor: '#f5af19', accent: '#f5af19', left: marker }],
    ['kein Player', { unavailable: true, playing: false, iconColor: '#4a4a50', accent: '#ccc', left: { ...marker, color: '#4a4a50' } }],
];

const S = 144, pad = 16, labelH = 26;
const W = keys.length * (S + pad) + pad;
const H = labelH + S + pad * 2;
const parts = [`<rect width="${W}" height="${H}" fill="#1b1b1f"/>`];
keys.forEach(([label, view], i) => {
    const x = pad + i * (S + pad);
    const svg = Buffer.from(renderPlayPauseKey(view).split(',')[1], 'base64').toString();
    parts.push(`<text x="${x + S / 2}" y="20" text-anchor="middle" font-family="Segoe UI, Arial" font-size="14" fill="#ddd">${label}</text>`);
    parts.push(`<clipPath id="c${i}"><rect x="${x}" y="${labelH + 4}" width="${S}" height="${S}" rx="14"/></clipPath>`);
    parts.push(`<g clip-path="url(#c${i})"><svg x="${x}" y="${labelH + 4}" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '').replaceAll('corner-left', `cl${i}`).replaceAll('corner-right', `cr${i}`)}</svg></g>`);
});
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`)).png().toFile(out);
console.log(out);
