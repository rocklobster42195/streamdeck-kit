// The kit's real Panorama section of the property inspector in a normal browser, with a faked plugin side
// that uses the kit's real code (effect registry, picture store, Image effect). No Stream Deck needed.
//
//   npm run build -w packages/kit
//   node tools/pi-harness.mjs serve                     → http://localhost:5310/?effect=image&width=320
//   node tools/pi-harness.mjs shot <out.png> [?query]   → screenshot with Edge/Chrome (headless)
//
// Query: effect=colour|image|particles · width=<px of the PI> · lang=en|de|es · pick=1 (picks the
// picture given with --picture, through the PI's own code) · url=<address> (a real web picture) · cam=ok|bad (a fake camera serving that picture, with a login) · summary=1 (the short PI line) · set=key:value,key:value (row settings)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

const root = path.resolve('packages/kit');
const load = async (p) => import(pathToFileURL(path.join(root, 'dist/panorama', p)).href);
const { listEffects, effectRegistry } = await load('registry.js');
const store = await load('image-store.js');
const src = await load('image-source.js');
store.configurePanoramaStorage({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'kit-pi-harness-')) });

const args = process.argv.slice(2);
const mode = args[0] ?? 'serve';
const pictureArg = args.indexOf('--picture');
const picture = pictureArg > -1 ? path.resolve(args[pictureArg + 1]) : undefined;
const PORT = Number(process.env.PORT ?? 5310);

// ---- the faked plugin side -------------------------------------------------------------------
const row = { effect: 'image', settings: {} };
const dials = [
    { column: 0, plugin: 'SO-C', label: 'Queue', member: true, self: false },
    { column: 1, plugin: 'SO-C', label: 'Living Room', member: true, self: true },
    { column: 2, plugin: 'MA-C', label: 'Kitchen', member: true, self: false },
    { column: 3, plugin: 'SO-C', label: 'Panorama', member: true, self: false },
];
const log = [];
/** Responses held back so the browser's load event (and with it the screenshot) waits for the picture to be done. */
const holds = [];
const release = () => setTimeout(() => holds.splice(0).forEach((r) => r.writeHead(200, { 'content-type': 'image/gif' }).end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'))), 400);
const note = (...a) => {
    log.push(a.join(' '));
    console.log('[plugin]', ...a);
};

/** What the Image effect makes of the row right now (the plugin side of the picture). */
let running;
let ticker;
function checkEffect() {
    running?.destroy?.();
    clearInterval(ticker);
    running = undefined;
    const def = effectRegistry.get(row.effect);
    if (!def || row.effect !== 'image') return;
    const inst = def.createInstance();
    running = inst;
    inst.initPanorama({ width: dials.length * 200, height: 100, settings: { ...def.defaultSettings, ...row.settings } });
    const report = () => {
        const slices = dials.map((_, i) => inst.renderSlice(i * 200, 200, 100)).filter(Boolean).length;
        note(`image effect: ${slices} of ${dials.length} slices rendered`);
    };
    inst.tickPanorama(1000);
    report();
    // Like the engine: tick it every second (a web picture arrives a moment after the first tick)
    let n = 0;
    ticker = setInterval(() => {
        inst.tickPanorama(1000);
        if (++n === 2) report();
    }, 1000);
}

const wss = new WebSocketServer({ port: PORT + 1 });
wss.on('connection', (ws) => {
    const send = (payload) => ws.send(JSON.stringify({ event: 'sendToPropertyInspector', payload }));
    const push = () => send({ event: 'panorama-row', device: 'dev', effect: row.effect, settings: row.settings, effects: listEffects(), dials, color: row.settings.rowColor ?? 'cover', covers: [], sourceStatus: row.settings.source?.kind === 'url' ? src.getSourceStatus(row.settings.source.url) : undefined });
    const off = src.onSourceStatus(() => {
        push();
        release();
    });
    ws.on('close', off);
    ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw));
        if (msg.event === 'getGlobalSettings') return ws.send(JSON.stringify({ event: 'didReceiveGlobalSettings', payload: { settings: {} } }));
        if (msg.event !== 'sendToPlugin') return;
        const p = msg.payload ?? {};
        if (p.event === 'pi-ready') push();
        else if (p.event === 'panorama-image-chunk') {
            if (store.receiveImageChunk(p)) note(`picture stored (${p.total} chunks)`);
        } else if (p.event === 'panorama-set') {
            if (typeof p.effect === 'string' && p.effect !== row.effect) {
                const scrim = row.settings.rowScrim;
                row.effect = p.effect;
                row.settings = { ...(p.settings ?? {}), ...(scrim === undefined ? {} : { rowScrim: scrim }) };
            } else row.settings = { ...row.settings, ...(p.settings ?? {}) };
            note('panorama-set', JSON.stringify(p));
            checkEffect();
            push();
            if (p.settings && 'source' in p.settings) release();
        } else note('sendToPlugin', JSON.stringify(p).slice(0, 120));
    });
});

// ---- the page --------------------------------------------------------------------------------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.map': 'application/json' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const send = (file, type) => (fs.existsSync(file) ? res.writeHead(200, { 'content-type': type ?? types[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file)) : res.writeHead(404).end('not found'));
    if (u.pathname === '/cam.jpg') {
        if (req.headers.authorization !== `Basic ${Buffer.from('viewer:secret').toString('base64')}`) return res.writeHead(401).end();
        return picture ? send(picture, 'image/jpeg') : res.writeHead(404).end();
    }
    if (u.pathname === '/') {
        const q = u.searchParams;
        const width = Number(q.get('width') ?? 320);
        const info = { application: { language: q.get('lang') ?? 'en', platform: 'windows', version: '7.1' }, plugin: { uuid: 'harness', version: '0' } };
        const actionInfo = { action: 'harness.panorama', context: 'ctx', device: 'dev', payload: { settings: {} } };
        if (q.get('effect')) row.effect = q.get('effect');
        if (q.get('set')) for (const kv of q.get('set').split(',')) { const [k, v] = kv.split(':'); row.settings[k] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v); }
        if (q.has('cam')) row.settings.source = { kind: 'url', url: `http://localhost:${PORT}/cam.jpg`, user: 'viewer', password: q.get('cam') === 'bad' ? 'wrong' : 'secret', intervalSec: 60 };
        if (q.get('url')) row.settings.source = { kind: 'url', url: q.get('url'), intervalSec: 60 };
        const pick = q.has('pick') && picture;
        const wait = q.has('cam') || q.has('url');
        if (wait) setTimeout(() => checkEffect(), 0);
        res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PI harness</title>
<link rel="stylesheet" href="/styles/pi-theme.css">
<script type="importmap">{"imports":{"@mdi/js":"/mdi.js"}}</script>
<style>body{width:${width}px;margin:0}</style></head><body>
<pi-panorama${q.has('summary') ? ' summary' : ''}></pi-panorama>
${pick || wait ? '<img src="/hold" width="1" height="1" style="position:absolute" alt="">' : ''}
<script type="module">
import { definePiComponents } from '/dist/pi/components/index.js';
import '/dist/pi/sd-client.js';
definePiComponents();
window.addEventListener('error', (e) => console.log('page error: ' + e.message));
window.addEventListener('unhandledrejection', (e) => console.log('page rejection: ' + e.reason));
connectElgatoStreamDeckSocket(${PORT + 1}, 'pi', 'registerPropertyInspector', ${JSON.stringify(JSON.stringify(info))}, ${JSON.stringify(JSON.stringify(actionInfo))});
${pick ? `
const wait = (f) => new Promise((ok) => { const t = setInterval(() => { const v = f(); if (v) { clearInterval(t); ok(v); } }, 100); });
console.log('pick: waiting for the field');
const el = await wait(() => document.querySelector('pi-panorama [data-source-status]') && document.querySelector('pi-panorama'));
console.log('pick: field there');
try {
  const blob = await (await fetch('/picture.jpg')).blob();
  console.log('pick: fetched ' + blob.size);
  await el.sendPicture(new File([blob], 'harbour-picture.jpg', { type: 'image/jpeg' }), el.querySelector('[data-source-status]'));
} catch (e) { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f88;white-space:pre-wrap">pick failed: ' + e + '</pre>'); }
` : ''}
document.title = 'ready';
</script></body></html>`);
    } else if (u.pathname === '/hold') {
        holds.push(res);
        setTimeout(release, 25000);
    } else if (u.pathname === '/picture.jpg' && picture) send(picture);
    else if (u.pathname === '/mdi.js') send(path.resolve('node_modules/@mdi/js/mdi.js'));
    else if (u.pathname.startsWith('/dist/')) send(path.join(root, u.pathname));
    else if (u.pathname.startsWith('/styles/')) send(path.join(root, u.pathname));
    else res.writeHead(404).end('not found');
});

server.listen(PORT, () => {
    if (mode === 'serve') return console.log(`PI harness: http://localhost:${PORT}/?effect=image&width=320${picture ? '&pick=1' : ''}`);
    const out = path.resolve(args[1] ?? 'pi-harness.png');
    const query = args[2] && !args[2].startsWith('--') ? args[2] : '?effect=image';
    const browser = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
    const width = Number(new URLSearchParams(query).get('width') ?? 320);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-pi-browser-'));
    const child = spawn(browser, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, `--window-size=${width},1300`, '--hide-scrollbars', '--enable-logging=stderr', '--v=0', ...(/[?&](pick|cam|url)/.test(query) ? [] : ['--virtual-time-budget=9000']), `--screenshot=${out}`, `http://localhost:${PORT}/${query}`], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', () => {
        const lines = err.split(String.fromCharCode(10)).filter((l) => /CONSOLE|Uncaught|error/i.test(l)).slice(0, 8);
        if (lines.length) console.log(lines.join(String.fromCharCode(10)));
        console.log('wrote', out);
        fs.rmSync(profile, { recursive: true, force: true });
        process.exit(0);
    });
});
