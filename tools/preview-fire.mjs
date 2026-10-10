// Preview sheet of fire effects for the Panorama: the classic "Doom fire" (heat grid), the same in the
// cover's colour, intensity by volume, a smoother "realistic" fire and a few other fire looks.
// Four dials wide (800 x 100, as a row of Stream Deck + dials). Invented cover colour, no audio.
//   node tools/preview-fire.mjs <out.png>     (needs `sharp`, e.g. from a plugin's node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'fire-preview.png');
const sharp = createRequire(path.resolve('../music-assistant-controller/package.json'))('sharp');

const W = 800, H = 100;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---- palettes -------------------------------------------------------------------------------
const DOOM = [
    [7, 7, 7], [31, 7, 7], [47, 15, 7], [71, 15, 7], [87, 23, 7], [103, 31, 7], [119, 31, 7], [143, 39, 7], [159, 47, 7], [175, 63, 7],
    [191, 71, 7], [199, 71, 7], [223, 79, 7], [223, 87, 7], [223, 87, 7], [215, 95, 7], [215, 95, 7], [215, 103, 15], [207, 111, 15],
    [207, 119, 15], [207, 127, 15], [207, 135, 23], [199, 135, 23], [199, 143, 23], [199, 151, 31], [191, 159, 31], [191, 159, 31],
    [191, 167, 39], [191, 167, 39], [191, 175, 47], [183, 175, 47], [183, 183, 47], [183, 183, 55], [207, 207, 111], [223, 223, 159],
    [239, 239, 199], [255, 255, 255],
];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// black -> dark cover -> cover -> light cover -> white, 37 steps (same length as Doom's)
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
// blackbody-like, smooth, for the realistic look (256 steps)
function firePalette() {
    const stops = [[0, [0, 0, 0]], [0.18, [40, 4, 2]], [0.38, [150, 25, 4]], [0.58, [235, 90, 8]], [0.78, [255, 175, 40]], [0.92, [255, 232, 140]], [1, [255, 250, 225]]];
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

// ---- Doom fire: the heat grid ----------------------------------------------------------------
// intensity 0..1 sets the heat of the bottom row (so the flames' height); wind shifts them sideways
function doomFire({ cell = 4, intensity = 1, wind = 0, steps = 120, palette = DOOM }) {
    const gw = W / cell, gh = Math.ceil(H / cell), max = palette.length - 1;
    // average decay per row is a third of `drop`; scaled so full heat reaches ~90 % of the height
    const drop = Math.max(1, Math.round(max / (0.33 * gh * 0.9)));
    const g = new Uint8Array(gw * gh);
    for (let s = 0; s < steps; s++) {
        for (let x = 0; x < gw; x++) g[(gh - 1) * gw + x] = Math.round(max * intensity);
        for (let y = 1; y < gh; y++) {
            for (let x = 0; x < gw; x++) {
                const src = y * gw + x, r = Math.floor(rnd() * 3);
                const dx = Math.min(gw - 1, Math.max(0, x - r + 1 + wind));
                const heat = Math.max(0, g[src] - (r & 1) * drop);
                g[(y - 1) * gw + dx] = heat;
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
}

// ---- realistic: fine grid, smoothing, turbulence and a cooling that grows with height ----------
function realisticFire({ intensity = 1, steps = 140 }) {
    const gw = 200, gh = 50; // 4 px cells, smoothed on enlargement
    const g = new Float32Array(gw * gh);
    const noise = (x, t) => 0.5 + 0.5 * (Math.sin(x * 0.21 + t * 0.13) * 0.6 + Math.sin(x * 0.07 - t * 0.05) * 0.4);
    for (let s = 0; s < steps; s++) {
        for (let x = 0; x < gw; x++) g[(gh - 1) * gw + x] = (0.55 + 0.45 * rnd()) * intensity * (0.6 + 0.5 * noise(x, s));
        const next = new Float32Array(g);
        for (let y = 0; y < gh - 1; y++) {
            for (let x = 0; x < gw; x++) {
                const sx = Math.round(x + (noise(x * 0.5 + y * 1.3, s) - 0.5) * 3.4 + (rnd() - 0.5) * 1.2);
                const x0 = Math.min(gw - 1, Math.max(0, sx));
                const below = g[(y + 1) * gw + x0];
                const avg = (g[(y + 1) * gw + Math.max(0, x0 - 1)] + below * 2 + g[(y + 1) * gw + Math.min(gw - 1, x0 + 1)]) / 4;
                const cool = 0.006 + 0.055 * Math.pow(1 - y / gh, 0.6) * rnd() * (0.5 + noise(x * 0.8, s * 1.7));
                next[y * gw + x] = Math.max(0, avg - cool);
            }
        }
        g.set(next);
    }
    const pal = firePalette();
    const small = Buffer.alloc(gw * gh * 3);
    for (let i = 0; i < gw * gh; i++) {
        const c = pal[Math.min(255, Math.round(Math.pow(Math.min(1, g[i] * 1.25), 0.85) * 255))];
        small[i * 3] = c[0]; small[i * 3 + 1] = c[1]; small[i * 3 + 2] = c[2];
    }
    return { buf: small, w: gw, h: gh };
}

// ---- SVG looks: embers, flame tongues ---------------------------------------------------------
function embers(color) {
    const dots = [];
    for (let i = 0; i < 70; i++) {
        const x = rnd() * W, y = H - Math.pow(rnd(), 1.7) * (H + 10), r = 0.8 + rnd() * 2.4;
        const heat = 1 - y / H;
        const c = mix(hex(color), [255, 230, 150], heat * 0.8);
        dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgb(${c})" opacity="${(0.35 + 0.65 * (1 - heat * 0.6)).toFixed(2)}"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="0.9"/></filter><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="#08080a"/><rect width="${W}" height="${H}" fill="url(#g)"/><g filter="url(#b)">${dots.join('')}</g></svg>`;
}
function tongues(level) {
    const paths = [];
    for (let i = 0; i < 26; i++) {
        const cx = (i + 0.5) * (W / 26) + (rnd() - 0.5) * 14;
        const h = (14 + rnd() * 70) * level, w = 12 + rnd() * 16;
        const sway = (rnd() - 0.5) * 22;
        paths.push(`<path d="M ${cx - w / 2} ${H + 2} C ${cx - w / 2} ${H - h * 0.45}, ${cx + sway - w * 0.25} ${H - h * 0.8}, ${cx + sway} ${H - h} C ${cx + sway + w * 0.25} ${H - h * 0.8}, ${cx + w / 2} ${H - h * 0.45}, ${cx + w / 2} ${H + 2} Z" fill="url(#f)" opacity="${(0.55 + rnd() * 0.4).toFixed(2)}"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="2.2"/></filter><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff2b0"/><stop offset="0.3" stop-color="#ffb02e"/><stop offset="0.7" stop-color="#e2420a"/><stop offset="1" stop-color="#5a0d00" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="#0a0504"/><g filter="url(#b)">${paths.join('')}</g></svg>`;
}
// fire bars: an equalizer made of flames, a column per band, height by level
function fireBars(color) {
    const cols = [];
    const n = 40;
    for (let i = 0; i < n; i++) {
        const level = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(i * 0.7) * Math.cos(i * 0.23), 1.3) * (0.6 + 0.4 * rnd());
        const h = level * 92;
        cols.push(`<rect x="${i * (W / n) + 1}" y="${H - h}" width="${W / n - 2}" height="${h}" rx="2" fill="url(#f)"/>`);
    }
    const c = hex(color);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgb(${mix(c, [255, 255, 255], 0.7)})"/><stop offset="0.45" stop-color="${color}"/><stop offset="1" stop-color="rgb(${mix(c, [0, 0, 0], 0.7)})" stop-opacity="0.2"/></linearGradient></defs><rect width="${W}" height="${H}" fill="#08080a"/>${cols.join('')}</svg>`;
}

// ---- compose -----------------------------------------------------------------------------------
const COVER = '#ff5a8a'; // an invented cover colour (pink)
const strips = [];
const raw = (buf, w = W, h = H, scale) => {
    let img = sharp(buf, { raw: { width: w, height: h, channels: 3 } });
    if (scale) img = img.resize(W, H, { kernel: scale });
    return img.png().toBuffer();
};
const svg = (s) => sharp(Buffer.from(s)).png().toBuffer();

strips.push(['Klassisch (PSX-Palette), volle Intensität', await raw(doomFire({ intensity: 1 }))]);
strips.push(['Klassisch, Intensität nach Lautstärke: 25 %', await raw(doomFire({ intensity: 0.25 }))]);
strips.push(['… 60 %', await raw(doomFire({ intensity: 0.6 }))]);
strips.push(['… 100 %', await raw(doomFire({ intensity: 1 }))]);
strips.push(['Klassisch in Cover-Farbe (Pink), 80 %', await raw(doomFire({ intensity: 0.8, palette: coverPalette(COVER) }))]);
strips.push(['Klassisch in Cover-Farbe (Blau), 80 %', await raw(doomFire({ intensity: 0.8, palette: coverPalette('#3a8dde') }))]);
strips.push(['Klassisch, gröber (8 px, wie im Spiel)', await raw(doomFire({ cell: 8, intensity: 0.9, steps: 90 }))]);
strips.push(['Klassisch, feiner (2 px), mit Wind', await raw(doomFire({ cell: 2, intensity: 0.9, wind: 1, steps: 160 }))]);
const real = realisticFire({ intensity: 0.95 });
strips.push(['Realistisch (feines Raster, geglättet, Turbulenz)', await raw(real.buf, real.w, real.h, 'cubic')]);
const real2 = realisticFire({ intensity: 0.45 });
strips.push(['Realistisch, leiser (45 %)', await raw(real2.buf, real2.w, real2.h, 'cubic')]);
strips.push(['Andere: Flammenzungen (Vektor, weich)', await svg(tongues(0.9))]);
strips.push(['Andere: Funken / Glut in Cover-Farbe', await svg(embers(COVER))]);
strips.push(['Andere: Feuer-Equalizer (Spalten nach Pegel)', await svg(fireBars('#ff8a1e'))]);

const pad = 14, label = 20, S = 1;
const sheetW = W * S + pad * 2, sheetH = strips.length * (H * S + label + 8) + pad * 2;
const layers = [];
const parts = [`<rect width="${sheetW}" height="${sheetH}" fill="#1b1b1f"/>`];
let y = pad;
strips.forEach(([name, png], i) => {
    parts.push(`<text x="${pad}" y="${y + 14}" font-family="Segoe UI, Arial" font-size="13" fill="#ddd">${name}</text>`);
    layers.push({ input: png, left: pad, top: y + label });
    y += H * S + label + 8;
});
const base = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">${parts.join('')}</svg>`)).png().toBuffer();
await sharp(base).composite(layers).png().toFile(out);
console.log(out);
