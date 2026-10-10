// Animated previews of the fire effects (GIFs, four dials wide: 800 x 100), the same algorithms as
// preview-fire.mjs but stepped frame by frame. The "volume" is an invented level curve (a beat every
// ~0.6 s over a slow swell) so the flames' height follows it. One GIF per look.
//   node tools/preview-fire-gif.mjs <out-dir>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] ?? 'fire-gifs');
fs.mkdirSync(outDir, { recursive: true });
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');

const W = 800, H = 100, FPS = 12, SECONDS = 8, FRAMES = FPS * SECONDS;
let seed = 4242;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// An invented loudness: a slow swell, beats about every 0.6 s, a quiet bit in the middle
function level(frame) {
    const t = frame / FPS;
    const swell = 0.55 + 0.35 * Math.sin(t * 0.8);
    const beat = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 2 / 0.6), 3) * 0.35;
    const quiet = t > 3.2 && t < 4.4 ? 0.25 : 1;
    return clamp01((swell * 0.75 + beat) * quiet);
}

// ---- palettes (as in preview-fire.mjs) --------------------------------------------------------
const DOOM = [
    [7, 7, 7], [31, 7, 7], [47, 15, 7], [71, 15, 7], [87, 23, 7], [103, 31, 7], [119, 31, 7], [143, 39, 7], [159, 47, 7], [175, 63, 7],
    [191, 71, 7], [199, 71, 7], [223, 79, 7], [223, 87, 7], [223, 87, 7], [215, 95, 7], [215, 95, 7], [215, 103, 15], [207, 111, 15],
    [207, 119, 15], [207, 127, 15], [207, 135, 23], [199, 135, 23], [199, 143, 23], [199, 151, 31], [191, 159, 31], [191, 159, 31],
    [191, 167, 39], [191, 167, 39], [191, 175, 47], [183, 175, 47], [183, 183, 47], [183, 183, 55], [207, 207, 111], [223, 223, 159],
    [239, 239, 199], [255, 255, 255],
];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function coverPalette(color) {
    const c = hex(color), n = 37, p = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        if (t < 0.45) p.push(mix([7, 7, 7], mix([0, 0, 0], c, 0.55), t / 0.45));
        else if (t < 0.8) p.push(mix(mix([0, 0, 0], c, 0.55), c, (t - 0.45) / 0.35));
        else p.push(mix(c, [255, 255, 255], ((t - 0.8) / 0.2) * 0.85));
    }
    return p;
}
function smoothFirePalette() {
    const stops = [[0, [0, 0, 0]], [0.15, [40, 4, 2]], [0.35, [150, 25, 4]], [0.55, [235, 90, 8]], [0.78, [255, 175, 40]], [0.92, [255, 232, 140]], [1, [255, 250, 225]]];
    const p = [];
    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let k = 1;
        while (k < stops.length - 1 && stops[k][0] < t) k++;
        const [t0, c0] = stops[k - 1], [t1, c1] = stops[k];
        p.push(mix(c0, c1, (t - t0) / (t1 - t0)));
    }
    return p;
}

// ---- Doom fire, stepped ------------------------------------------------------------------------
function doomFire({ cell, palette, wind = 0, stepsPerFrame = 2 }) {
    const gw = W / cell, gh = Math.ceil(H / cell), max = palette.length - 1;
    const drop = Math.max(1, Math.round(max / (0.33 * gh * 0.9)));
    const g = new Uint8Array(gw * gh);
    let smooth = 0.3;
    return (frame) => {
        // The bottom row's heat follows the level, a little smoothed (quick up, slower down)
        const target = level(frame);
        smooth += (target - smooth) * (target > smooth ? 0.6 : 0.25);
        const heat = Math.round(max * clamp01(0.12 + 0.88 * smooth));
        for (let s = 0; s < stepsPerFrame; s++) {
            for (let x = 0; x < gw; x++) g[(gh - 1) * gw + x] = heat;
            for (let y = 1; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    const src = y * gw + x, r = Math.floor(rnd() * 3);
                    const dx = Math.min(gw - 1, Math.max(0, x - r + 1 + wind));
                    g[(y - 1) * gw + dx] = Math.max(0, g[src] - (r & 1) * drop);
                }
            }
        }
        const buf = Buffer.alloc(W * H * 3);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const c = palette[g[Math.floor(y / cell) * gw + Math.floor(x / cell)]];
                const o = (y * W + x) * 3;
                buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
            }
        }
        return buf;
    };
}

// ---- flame tongues as a raster ---------------------------------------------------------------
function tongues() {
    const n = 30, pal = smoothFirePalette();
    const T = Array.from({ length: n }, (_, i) => ({ cx: (i + 0.5) * (W / n) + (rnd() - 0.5) * 12, w: 14 + rnd() * 16, h: 0.4, target: rnd(), sway: 0, phase: rnd() * 6, speed: 0.5 + rnd() }));
    return (frame) => {
        const lv = level(frame);
        for (const t of T) {
            if (rnd() < 0.18) t.target = rnd();
            t.h += (t.target * (0.3 + 0.9 * lv) - t.h) * 0.35;
            t.phase += 0.25 * t.speed;
            t.sway = Math.sin(t.phase) * 7;
        }
        const buf = Buffer.alloc(W * H * 3);
        for (let x = 0; x < W; x++) {
            // The column's flame: the tallest tongue over it
            let top = 0, edge = 1;
            for (const t of T) {
                const u = (x - (t.cx + t.sway * 0.4)) / (t.w / 2);
                if (Math.abs(u) >= 1) continue;
                const bump = Math.pow(1 - u * u, 1.4);
                const h = t.h * 88 * bump;
                if (h > top) { top = h; edge = 1 - Math.abs(u); }
            }
            for (let y = 0; y < H; y++) {
                const up = H - y;
                if (up > top) continue;
                const tt = up / Math.max(1, top);
                // Hot at the bottom and in the middle of the tongue, cooler to the tip and edges
                const heat = clamp01((1 - tt) * 0.95 * (0.55 + 0.45 * edge) * (0.92 + 0.16 * rnd()));
                const c = pal[Math.min(255, Math.round(heat * 255))];
                const o = (y * W + x) * 3;
                buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
            }
        }
        return buf;
    };
}

// ---- embers: glowing points rising, more of them and faster when loud --------------------------
function embers(color) {
    const base = hex(color);
    let P = [];
    return (frame) => {
        const lv = level(frame);
        const spawn = 0.4 + 5 * lv;
        for (let i = 0; i < spawn + (rnd() < spawn % 1 ? 1 : 0); i++) P.push({ x: rnd() * W, y: H + 2, vy: 0.6 + rnd() * 1.4 + lv * 1.3, vx: (rnd() - 0.5) * 0.6, r: 0.8 + rnd() * 1.8, life: 0.55 + rnd() * 0.45 });
        const acc = new Float32Array(W * H * 3);
        const bg = [8, 8, 10];
        P = P.filter((p) => {
            p.x += p.vx + Math.sin((p.y + p.x) * 0.05) * 0.3;
            p.y -= p.vy;
            p.life -= 0.012;
            return p.life > 0 && p.y > -4;
        });
        for (const p of P) {
            const heat = clamp01(p.life);
            const c = mix(base, [255, 235, 160], heat * 0.6);
            const R = Math.ceil(p.r * 3);
            for (let dy = -R; dy <= R; dy++) {
                for (let dx = -R; dx <= R; dx++) {
                    const x = Math.round(p.x) + dx, y = Math.round(p.y) + dy;
                    if (x < 0 || x >= W || y < 0 || y >= H) continue;
                    const d2 = (dx * dx + dy * dy) / (p.r * p.r);
                    const a = Math.exp(-d2 * 0.9) * heat;
                    const o = (y * W + x) * 3;
                    acc[o] += c[0] * a; acc[o + 1] += c[1] * a; acc[o + 2] += c[2] * a;
                }
            }
        }
        const buf = Buffer.alloc(W * H * 3);
        for (let y = 0; y < H; y++) {
            const glow = Math.pow(y / H, 2.2) * (0.25 + 0.5 * lv);
            for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 3;
                for (let k = 0; k < 3; k++) buf[o + k] = Math.min(255, bg[k] + base[k] * glow * 0.5 + acc[o + k]);
            }
        }
        return buf;
    };
}

async function gif(name, step) {
    const frames = [];
    // a short run-in so the fire is settled at the first frame
    for (let f = -FPS; f < 0; f++) step(0);
    for (let f = 0; f < FRAMES; f++) frames.push(await sharp(step(f), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer());
    const file = path.join(outDir, name);
    await sharp(frames, { join: { animated: true } }).gif({ delay: Math.round(1000 / FPS), loop: 0, effort: 3 }).toFile(file);
    console.log(file, `${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

await gif('fire-doom-classic.gif', doomFire({ cell: 4, palette: DOOM }));
await gif('fire-doom-cover-pink.gif', doomFire({ cell: 4, palette: coverPalette('#ff5a8a') }));
await gif('fire-doom-cover-blue.gif', doomFire({ cell: 4, palette: coverPalette('#3a8dde') }));
await gif('fire-doom-coarse-8px.gif', doomFire({ cell: 8, palette: DOOM }));
await gif('fire-tongues.gif', tongues());
await gif('fire-embers-cover-pink.gif', embers('#ff5a8a'));
