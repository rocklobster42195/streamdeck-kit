// Preview of the status on keys and dials: loading (the hourglass in the middle, as the paused play
// symbol) and failed (a badge at the bottom left). Run `npm run build` first.
//   node tools/preview-status.mjs <out.png>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
import { renderPlayPauseKey, renderPlaybackKey, renderTrackDial, renderVolumeDial, renderVolumeKey } from '../packages/kit/dist/index.js';
import { mdiShuffleVariant } from '@mdi/js';

const out = path.resolve(process.argv[2] ?? 'status-preview.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');
const data = (u) => Buffer.from(u.split(',')[1], 'base64').toString();
const inner = (svg) => svg.replace(/^<svg[^>]*>|<\/svg>$/g, '');

const cover = async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a3d"/><stop offset="0.6" stop-color="#c2185b"/><stop offset="1" stop-color="#4a148c"/></linearGradient></defs><rect width="288" height="288" fill="url(#g)"/><circle cx="190" cy="100" r="60" fill="#fff" opacity="0.18"/></svg>';
    return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')}`;
};
const c = await cover();
const keyBase = { icon: mdiShuffleVariant, color: '#e0e0e0' };
const volBase = { command: 'up', volume: 42, muted: false, preset: 20, showVolume: true, gauge: 'ring', color: '#e0e0e0' };
const keys = [
    ['Play/Pause, spielt', renderPlayPauseKey({ playing: true, cover: c, iconColor: '#ccc', accent: '#ffb199', progress: 0.4 })],
    ['… lädt', renderPlayPauseKey({ playing: true, cover: c, iconColor: '#ccc', accent: '#ffb199', progress: 0.4, status: 'loading' })],
    ['Pause (zum Vergleich)', renderPlayPauseKey({ playing: false, cover: c, iconColor: '#ccc', accent: '#ffb199', progress: 0.4 })],
    ['… Pause und lädt', renderPlayPauseKey({ playing: false, cover: c, iconColor: '#ccc', accent: '#ffb199', progress: 0.4, status: 'loading' })],
    ['Playback, lädt', renderPlaybackKey({ ...keyBase, status: 'loading' })],
    ['Playback, Fehler', renderPlaybackKey({ ...keyBase, status: 'failed' })],
    ['Volume, lädt', renderVolumeKey({ ...volBase, status: 'loading' })],
    ['Volume, Fehler', renderVolumeKey({ ...volBase, status: 'failed' })],
];
const dials = [
    ['Volume-Dial', renderVolumeDial({ name: 'Wohnzimmer', volume: 42, muted: false, mutedLabel: 'STUMM' })],
    ['… lädt', renderVolumeDial({ name: 'Wohnzimmer', volume: 42, muted: false, mutedLabel: 'STUMM', status: 'loading' })],
    ['… Fehler', renderVolumeDial({ name: 'Wohnzimmer', volume: 42, muted: false, mutedLabel: 'STUMM', status: 'failed' })],
    ['Track, Pause', renderTrackDial({ title: 'Erfundener Song', artist: 'Sim Artist', cover: c, playing: false, progress: 0.4, accent: '#ffb199', nothing: '-' })],
    ['… lädt', renderTrackDial({ title: 'Erfundener Song', artist: 'Sim Artist', cover: c, playing: true, progress: 0.4, accent: '#ffb199', nothing: '-', status: 'loading' })],
    ['… Fehler', renderTrackDial({ title: 'Erfundener Song', artist: 'Sim Artist', cover: c, playing: true, progress: 0.4, accent: '#ffb199', nothing: '-', status: 'failed' })],
];
const pad = 14, head = 22, gap = 12;
const parts = [];
let x = pad;
keys.forEach(([label, uri], i) => {
    parts.push(`<text x="${x + 72}" y="${pad + 14}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="12" fill="#ddd">${label}</text>`);
    parts.push(`<g transform="translate(${x} ${pad + head})"><svg width="144" height="144" viewBox="0 0 144 144">${inner(data(uri)).replace(/id="/g, `id="k${i}`)}</svg></g>`);
    x += 144 + gap;
});
const y2 = pad + head + 144 + 28;
let x2 = pad;
dials.forEach(([label, uri], i) => {
    parts.push(`<text x="${x2 + 100}" y="${y2}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="12" fill="#ddd">${label}</text>`);
    parts.push(`<g transform="translate(${x2} ${y2 + 8})"><svg width="200" height="100" viewBox="0 0 200 100">${inner(data(uri)).replace(/id="/g, `id="d${i}`).replace(/url\(#/g, `url(#d${i}`)}</svg></g>`);
    x2 += 200 + gap;
});
const W = Math.max(x, x2) + pad, H = y2 + 100 + 8 + pad;
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1b1f"/>${parts.join('')}</svg>`)).png().toFile(out);
console.log(out);
