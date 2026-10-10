// Preview sheet of the universal Volume dial: SO-C's dial as published (its geometry copied from
// VolumePieDialAction) against the kit's renderer (SO-C's look, the user's choice). Run `npm run build` first.
//   node tools/preview-volume-dial.mjs <out.png>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { mdiSofa, mdiVolumeOff } from '@mdi/js';
import { arc, openRing, renderVolumeDial } from '../packages/kit/dist/index.js';

const out = path.resolve(process.argv[2] ?? 'volume-dial-preview.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');

// A stand-in Panorama: dark with soft coloured particles (the real one is a kit effect)
const effect = (hue) => {
    const dots = [];
    for (let i = 0; i < 26; i++) {
        const x = (i * 83) % 200, y = (i * 47) % 100, r = 3 + (i % 5) * 2;
        dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${hue + (i % 4) * 8} 80% 55%)" opacity="${0.35 + (i % 3) * 0.2}"/>`);
    }
    return `<rect width="200" height="100" fill="#10141c"/>${dots.join('')}`;
};

// SO-C 0.4.10's dial, geometry as in VolumePieDialAction.buildPieParts / buildTextParts
const soOld = ({ name, volume, muted, gauge = 'pie', align = 'left', showText = true, icon, bg }) => {
    const cx = align === 'center' ? 100 : align === 'right' ? 150 : 50, cy = 50, color = '#CCCCCC';
    let parts;
    if (muted) parts = [`<g transform="translate(${cx - 38},${cy - 38}) scale(${76 / 24})"><path fill="${color}" d="${mdiVolumeOff}"/></g>`];
    else if (gauge === 'ring') {
        parts = arc(cx, cy, 34, volume / 100, color, { width: 8 });
        if (icon) parts.push(`<path transform="translate(${cx - 16} ${cy - 16}) scale(${32 / 24})" fill="${color}" d="${icon}"/>`);
    } else if (gauge === 'open') {
        parts = openRing({ cx, cy, r: 34, width: 8, min: 0, max: 100, value: volume, zones: [{ from: -Infinity, color }] });
        if (icon) parts.push(`<path transform="translate(${cx - 12} ${cy + 15})" fill="${color}" d="${icon}"/>`);
    } else {
        const a = (volume / 100) * 2 * Math.PI, x = cx + 30 * Math.sin(a), y = cy - 30 * Math.cos(a);
        parts = [`<circle cx="${cx}" cy="${cy}" r="38" stroke="${color}" stroke-width="6" fill="none"/>`, `<path d="M ${cx} ${cy} L ${cx} ${cy - 30} A 30 30 0 ${volume > 50 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="${color}"/>`];
    }
    const big = muted ? 'MUTE' : `${volume}%`, tx = align === 'right' ? 55 : 145;
    if (showText) {
        if (align === 'center') parts.push(`<rect x="${cx - 30}" y="${cy - 13}" width="60" height="26" rx="4" fill="#000" fill-opacity="0.6"/>`, `<text x="${cx}" y="${cy + 6}" fill="#fff" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle">${big}</text>`);
        else parts.push(`<rect x="${tx - 45}" y="${cy - 18}" width="90" height="42" rx="4" fill="#000" fill-opacity="0.6"/>`, `<text x="${tx}" y="${cy - 4}" fill="#fff" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle">${big}</text>`, `<text x="${tx}" y="${cy + 14}" fill="#ccc" font-family="Arial" font-size="11" text-anchor="middle">${name}</text>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">${bg ? bg : '<rect width="200" height="100" fill="#0a0a0a"/>'}${parts.join('')}</svg>`;
};

const fromData = (u) => Buffer.from(u.split(',')[1], 'base64').toString();
const kit = (v) => fromData(renderVolumeDial({ mutedLabel: 'Stumm', ...v, underlay: v.bg })).replace(/ id="strip"/g, '');

const cases = [
    ['Pie', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'pie' }],
    ['Ring', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'ring' }],
    ['Offener Ring', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'open' }],
    ['Ring + Icon', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'ring', icon: mdiSofa }],
    ['Offen + Icon, rechts', { name: 'Küche', volume: 71, muted: false, gauge: 'open', icon: mdiSofa, align: 'right' }],
    ['Stumm (Pie)', { name: 'Wohnzimmer', volume: 42, muted: true, gauge: 'pie' }],
    ['Ohne Text, Ring', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'ring', showText: false }],
    ['Mitte, Ring', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'ring', align: 'center' }],
    ['Panorama, Pie', { name: 'Wohnzimmer', volume: 42, muted: false, gauge: 'pie', bg: effect(200) }],
    ['Panorama, Offen', { name: 'Büro', volume: 18, muted: false, gauge: 'open', bg: effect(20) }],
];
const rows = [
    ['SO-C 0.4.10 (heute)', (v) => soOld({ ...v, bg: v.bg ? `<rect width="200" height="100" fill="#000"/>${v.bg}` : undefined })],
    ['Kit-Renderer (Vorschlag)', (v) => kit(v)],
];

const cols = 5, S = 1.3, cw = 200 * S, ch = 100 * S, pad = 12, head = 24, rowLabel = 22;
const sheetRows = [];
const parts = [];
let y = pad;
let n = 0;
for (let g = 0; g < cases.length; g += cols) {
    const group = cases.slice(g, g + cols);
    group.forEach(([label], i) => parts.push(`<text x="${pad + i * (cw + pad) + cw / 2}" y="${y + 16}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="13" fill="#ddd">${label}</text>`));
    y += head;
    for (const [rowName, draw] of rows) {
        parts.push(`<text x="${pad}" y="${y + 14}" font-family="Segoe UI, Arial" font-size="11" fill="#8a8a90">${rowName}</text>`);
        y += rowLabel - 6;
        group.forEach(([, v], i) => {
            const x = pad + i * (cw + pad);
            const svg = draw(v).replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/id="strip"/g, '').replace(/url\(#strip\)/g, '');
            parts.push(`<g transform="translate(${x} ${y}) scale(${S})"><svg width="200" height="100" viewBox="0 0 200 100">${svg}</svg></g>`);
        });
        y += ch + 8;
    }
    y += 10;
}
const W = pad + cols * (cw + pad), H = y + pad;
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1b1f"/>${parts.join('')}</svg>`)).png().toFile(out);
console.log(out);
