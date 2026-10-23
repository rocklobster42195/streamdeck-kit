// Ken Burns (zoom and pan) of the Image effect as a small player in an HTML file: the real steps of the
// effect, as the group would tick it (slowly at rest, 5 times a second while it moves), over several
// intervals, so the random moves can be seen. Played with a speed control. The page needs no network.
//   npm run build -w packages/kit && node tools/preview-panorama-player.mjs <out.html> <picture.jpg | https://camera/snapshot.jpg> [dials=4] [interval=60] [intervals=5] [--artifact]
// --artifact writes the page in the form the Artifact tool wants (title, tokens, no <html>/<body>).
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const artifact = process.argv.includes('--artifact');
const out = path.resolve(args[0] ?? 'ken-burns.html');
const arg = args[1];
const dials = Number(args[2] ?? 4);
const interval = Number(args[3] ?? 60);
const intervals = Number(args[4] ?? 5);
const load = async (p) => import(pathToFileURL(path.resolve('packages/kit/dist/panorama', p)).href);
const { default: image } = await load('effects/image/index.js');
const store = await load('image-store.js');
const { fetchPicture } = await load('image-source.js');
store.configurePanoramaStorage({ dir: mkdtempSync(path.join(tmpdir(), 'kit-pano-')) });
if (!arg) throw new Error('give a picture (a file or an address)');
store.saveImage('0123456789abcdef', /^https?:/.test(arg) ? await fetchPicture({ kind: 'url', url: arg }) : readFileSync(path.resolve(arg)));

// Tick the effect the way the engine does: the first tick after its start interval, then as it asks (tickMs)
const hrefs = [];
const hrefIndex = new Map();
const data = {};
for (const motion of ['zoom', 'pan']) {
    const e = image.createInstance();
    e.initPanorama({ width: dials * 200, height: 100, settings: { source: { kind: 'file', id: '0123456789abcdef', name: 'picture', w: 0, h: 0 }, fit: 'fill', motion, motionSeconds: interval } });
    const frames = [];
    let t = 0;
    let dt = 1000;
    const total = interval * intervals * 1000;
    while (t <= total) {
        frames.push([Math.round(t), Array.from({ length: dials }, (_, d) => {
            const f = e.renderSlice(d * 200, 200, 100);
            const href = /href="([^"]+)"/.exec(f)[1];
            if (!hrefIndex.has(href)) hrefIndex.set(href, hrefs.push(href) - 1);
            return [hrefIndex.get(href), /width="([\d.]+)" height="([\d.]+)" transform="([^"]+)"/.exec(f).slice(1)];
        })]);
        e.tickPanorama(dt);
        t += dt;
        dt = e.tickMs?.() ?? 1000;
    }
    data[motion] = frames;
}

const style = artifact
    ? `/* Layout: one column; two decks (black strips, the dials of a Stream Deck +) under a small control bar. */
:root{--bg:#f3f4f6;--fg:#1d1f23;--mute:#5d636d;--btn:#e4e7ec;--btn-line:#c7ccd4;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141517;--fg:#e9eaec;--mute:#9aa0a9;--btn:#23262b;--btn-line:#3a3e45;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141517;--fg:#e9eaec;--mute:#9aa0a9;--btn:#23262b;--btn-line:#3a3e45;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:14px/1.5 "Segoe UI",system-ui,sans-serif;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}`
    : `:root{color-scheme:dark}body{margin:0;padding:24px;background:#141517;color:#e9eaec;font:14px/1.5 "Segoe UI",system-ui,sans-serif}`;
const vars = artifact ? { mute: 'var(--mute)', btn: 'var(--btn)', line: 'var(--btn-line)', fg: 'var(--fg)' } : { mute: '#9aa0a9', btn: '#23262b', line: '#3a3e45', fg: '#e9eaec' };
const css = `${style}
main{max-width:1000px;margin:0 auto;display:grid;gap:18px}h1{font-size:18px;margin:0;font-weight:600}p{margin:0;color:${vars.mute};max-width:70ch}
.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center}button,select{background:${vars.btn};color:${vars.fg};border:1px solid ${vars.line};border-radius:8px;padding:6px 12px;font:inherit}
button:focus-visible,select:focus-visible{outline:2px solid #6cc4ff;outline-offset:2px}
.row{display:grid;gap:6px}.name{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${vars.mute}}
.deck{display:grid;grid-template-columns:repeat(${dials},1fr);background:#000;border-radius:8px;overflow:hidden;position:relative}
.deck>svg{display:block;width:100%;aspect-ratio:2/1}.ring{position:absolute;top:50%;width:${(19 / dials).toFixed(2)}%;aspect-ratio:1;transform:translate(-50%,-50%)}`;
const body = `<main>
<h1>Ken Burns on ${dials} dials</h1>
<p>The real steps of the Image effect over ${intervals} intervals of ${interval} s: it rests, then makes one slow move to a new view (zoom in or out, pan to the left, right, up or down), and rests again. At rest it ticks once a second, during a move five times a second. Use the speed control to skip the waiting.</p>
<div class="bar"><button id="play">Pause</button><label>Speed <select id="speed"><option value="1">1×</option><option value="4">4×</option><option value="10" selected>10×</option><option value="30">30×</option></select></label><span id="clock"></span></div>
<div class="row"><span class="name">Slow zoom</span><div class="deck" id="zoom"></div></div>
<div class="row"><span class="name">Slow pan</span><div class="deck" id="pan"></div></div>
</main>
<script>
const HREFS=${JSON.stringify(hrefs)};const DATA=${JSON.stringify(data)};const N=${dials},TOTAL=${interval * intervals * 1000};
const ring='<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="4"/><circle cx="20" cy="20" r="15" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="62 94" transform="rotate(-90 20 20)"/><text x="20" y="24" text-anchor="middle" fill="#fff" font-size="11" font-family="sans-serif">42</text></svg>';
const NS='http://www.w3.org/2000/svg';const els={};
for(const m of ['zoom','pan']){const d=document.getElementById(m);els[m]=[];
 for(let i=0;i<N;i++){const s=document.createElementNS(NS,'svg');s.setAttribute('viewBox','0 0 200 100');s.setAttribute('overflow','hidden');const im=document.createElementNS(NS,'image');s.append(im);d.append(s);els[m].push(im)}
 for(let i=0;i<N-1;i++){const r=document.createElement('div');r.className='ring';r.style.left=((i+.5)*100/N)+'%';r.innerHTML=ring;d.append(r)}}
let t=0,playing=true,last=performance.now();
function show(){const ms=t%TOTAL;
 for(const m of ['zoom','pan']){const fr=DATA[m];let lo=0,hi=fr.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(fr[mid][0]<=ms)lo=mid;else hi=mid-1}
  fr[lo][1].forEach(([h,[w,hh,tr]],i)=>{const im=els[m][i];if(im.dataset.h!=h){im.setAttribute('href',HREFS[h]);im.dataset.h=h}im.setAttribute('width',w);im.setAttribute('height',hh);im.setAttribute('transform',tr)})}
 document.getElementById('clock').textContent=Math.floor(ms/1000)+' s of '+TOTAL/1000+' s'}
function frame(now){if(playing)t+=(now-last)*document.getElementById('speed').value;last=now;show();requestAnimationFrame(frame)}
document.getElementById('play').onclick=e=>{playing=!playing;e.target.textContent=playing?'Pause':'Play'};
requestAnimationFrame(frame);
</script>`;
const html = artifact
    ? `<title>Ken Burns Player</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${css}\n</style>\n${body}`
    : `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ken Burns on ${dials} dials</title><style>${css}</style></head><body>${body}</body></html>`;
writeFileSync(out, html);
console.log('wrote', out, `(${(html.length / 1048576).toFixed(2)} MB, ${data.zoom.length} + ${data.pan.length} steps)`);
