import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import omggif from 'omggif';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanoramaEngine } from '../src/panorama/engine.js';
import image, { motionJitter } from '../src/panorama/effects/image/index.js';
import { eachGifFrame, gifInfo, isGif, MAX_GIF_FRAMES } from '../src/panorama/image-gif.js';
import { makeWork, moveSeconds, motionPhase, placeTile, restAt, tileFor, windowFor } from '../src/panorama/image-motion.js';
import { configurePanoramaStorage, saveImage } from '../src/panorama/image-store.js';
import { effectRegistry } from '../src/panorama/registry.js';
import type { EffectDefinition } from '../src/panorama/types.js';

beforeAll(() => configurePanoramaStorage({ dir: mkdtempSync(join(tmpdir(), 'kit-motion-')) }));
const realJitter = motionJitter.next;
beforeEach(() => {
    // Tests start every motion at the beginning of its rest
    motionJitter.next = () => 0;
});
afterEach(() => {
    vi.useRealTimers();
    motionJitter.next = realJitter;
});

/** An animated GIF of `n` frames, each one a solid colour from a four-colour palette. */
function gif(n: number, w = 16, h = 16, delayCs = 10): Buffer {
    const buf = Buffer.alloc(w * h * n * 2 + 2048);
    const writer = new omggif.GifWriter(buf, w, h, { palette: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00], loop: 0 });
    for (let i = 0; i < n; i++) writer.addFrame(0, 0, w, h, new Array(w * h).fill(i % 4), { delay: delayCs });
    return buf.subarray(0, writer.end());
}

/** A wide picture, red on the left to blue on the right. */
function wide(w = 1600, h = 200): Buffer {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i] = Math.round(255 * (1 - x / (w - 1)));
            data[i + 1] = Math.round(255 * (y / (h - 1)));
            data[i + 2] = Math.round(255 * (x / (w - 1)));
            data[i + 3] = 255;
        }
    }
    return Buffer.from(jpeg.encode({ data, width: w, height: h }, 92).data);
}

describe('gif', () => {
    it('is recognised and read frame by frame with its delays', () => {
        const g = gif(3, 8, 8, 20);
        expect(isGif(g)).toBe(true);
        expect(isGif(wide(16, 16))).toBe(false);
        expect(gifInfo(g)).toEqual({ width: 8, height: 8, frames: 3 });
        const seen: { r: number; delay: number }[] = [];
        expect(eachGifFrame(g, (f, delay) => seen.push({ r: (f.data as Uint8Array)[0], delay }))).toBe(true);
        expect(seen.map((s) => s.r)).toEqual([255, 0, 0]); // red, green, blue: only red has a red part
        expect(seen.every((s) => s.delay === 200)).toBe(true);
    });

    it('plays at 10 fps at the most (a GIF asking for 0 is slowed down) and shows only the first frame when it is too long', () => {
        const delays: number[] = [];
        eachGifFrame(gif(2, 4, 4, 0), (_f, d) => delays.push(d));
        expect(delays).toEqual([100, 100]);
        let frames = 0;
        expect(eachGifFrame(gif(MAX_GIF_FRAMES + 1, 4, 4), () => frames++)).toBe(true);
        expect(frames).toBe(1);
    });

    it('does not read something that is no GIF', () => {
        expect(gifInfo(Buffer.from('GIF89 but broken'))).toBeUndefined();
        expect(eachGifFrame(Buffer.from('nope'), () => {})).toBe(false);
    });
});

describe('image effect with a GIF', () => {
    it('steps through the frames by time and asks for 10 ticks a second', () => {
        const id = 'aaaa0000bbbb0000';
        saveImage(id, gif(3, 32, 16, 10));
        const effect = image.createInstance();
        effect.initPanorama({ width: 400, height: 100, settings: { source: { kind: 'file', id, name: 'x.gif', w: 32, h: 16 }, fit: 'stretch' } });
        const first = effect.renderSlice(0, 200, 100);
        expect(first).toContain('<image');
        expect(effect.tickMs?.()).toBe(100);
        effect.tickPanorama(100);
        const second = effect.renderSlice(0, 200, 100);
        effect.tickPanorama(100);
        const third = effect.renderSlice(0, 200, 100);
        expect(new Set([first, second, third]).size).toBe(3);
        // and round again after the last frame
        effect.tickPanorama(100);
        expect(effect.renderSlice(0, 200, 100)).toBe(first);
    });
});

describe('Ken Burns', () => {
    it('rests most of the time and moves slowly at the end of every interval', () => {
        // A move every 60 s: it takes 15 s (a quarter), at the end of the interval
        expect(moveSeconds(60)).toBe(15);
        expect(moveSeconds(10)).toBe(8);
        expect(moveSeconds(600)).toBe(40);
        const rest = motionPhase(10, 60);
        expect(rest.moving).toBe(false);
        expect(rest.soon).toBe(false);
        expect(motionPhase(44, 60).soon).toBe(true); // a move is about to start: tick faster
        expect(motionPhase(44, 60).moving).toBe(false);
        const mid = motionPhase(52.5, 60);
        expect(mid.moving).toBe(true);
        expect(mid.e).toBeGreaterThan(Math.min(restAt(0), restAt(1)));
        expect(mid.e).toBeLessThan(Math.max(restAt(0), restAt(1)));
        // The move ends where the next rest begins, and then it stands still
        expect(motionPhase(60, 60).e).toBeCloseTo(restAt(1), 10);
        expect(motionPhase(70, 60).e).toBe(motionPhase(100, 60).e);
        expect(motionPhase(70, 60).moving).toBe(false);
    });

    it('goes somewhere clearly different every time, to either side, and never leaves the picture', () => {
        const dirs = new Set<string>();
        for (const axis of [0, 1] as const) {
            for (let n = 0; n < 200; n++) {
                const from = restAt(n, axis);
                const to = restAt(n + 1, axis);
                expect(to).toBeGreaterThanOrEqual(0);
                expect(to).toBeLessThanOrEqual(1);
                expect(Math.abs(to - from)).toBeGreaterThanOrEqual(0.35 - 1e-9);
                dirs.add(`${axis}${to > from ? '+' : '-'}`);
            }
        }
        expect([...dirs].sort()).toEqual(['0+', '0-', '1+', '1-']);
        // Not a plain back and forth: the sequence of directions is not strictly alternating
        const ups = Array.from({ length: 60 }, (_, n) => restAt(n + 1) > restAt(n));
        expect(ups.some((u, i) => i > 0 && u === ups[i - 1])).toBe(true);
        // The same every time it is asked
        expect(restAt(7)).toBe(restAt(7));
    });

    it('never looks outside the picture, at any step, and the tile always covers what a dial shows', () => {
        const work = makeWork({ width: 1600, height: 900, data: new Uint8Array(1600 * 900 * 4) }, 800, 100);
        for (const motion of ['zoom', 'pan'] as const) {
            for (const pos of [0, 50, 100]) {
                const tiles = [0, 1, 2, 3].map((d) => tileFor(motion, work, 800, 100, d * 200, 200, pos, pos));
                for (let i = 0; i <= 20; i++) {
                    for (let j = 0; j <= 4; j++) {
                        const win = windowFor(motion, i / 20, j / 4, work, 800, 100, pos, pos);
                        expect(win.x).toBeGreaterThanOrEqual(0);
                        expect(win.y).toBeGreaterThanOrEqual(0);
                        expect(win.x + win.w).toBeLessThanOrEqual(work.width + 1e-6);
                        expect(win.y + win.h).toBeLessThanOrEqual(work.height + 1e-6);
                        tiles.forEach((tile, d) => {
                            // The dial's own part of the window, in work pixels, lies inside its tile
                            const s = 800 / win.w;
                            const left = win.x + (d * 200) / s;
                            const right = win.x + ((d + 1) * 200) / s;
                            expect(left).toBeGreaterThanOrEqual(tile.x - 1e-6);
                            expect(right).toBeLessThanOrEqual(tile.x + tile.w + 1e-6);
                            expect(win.y).toBeGreaterThanOrEqual(tile.y - 1e-6);
                            expect(win.y + 100 / s).toBeLessThanOrEqual(tile.y + tile.h + 1e-6);
                        });
                    }
                }
            }
        }
    });

    it('puts the tile where the window says', () => {
        const win = { x: 100, y: 20, w: 400, h: 50 };
        const tile = { x: 90, y: 10, w: 300, h: 80 };
        const { tx, ty, s } = placeTile(win, tile, 800, 200);
        expect(s).toBe(2);
        expect(tx).toBeCloseTo((90 - 100) * 2 - 200, 10);
        expect(ty).toBeCloseTo((10 - 20) * 2, 10);
    });

    it('stands still for a long time, speeds up before a move and slows down after it', () => {
        const id = 'cccc1111dddd1111';
        saveImage(id, wide());
        const source = { kind: 'file' as const, id, name: 'wide.jpg', w: 1600, h: 200 };
        const effect = image.createInstance();
        effect.initPanorama({ width: 800, height: 100, settings: { source, fit: 'fill', motion: 'zoom', motionSeconds: 60 } });
        const start = effect.renderSlice(400, 200, 100);
        expect(start).toContain('<image');
        expect(start).toContain('transform="translate(');
        expect(effect.tickMs?.()).toBe(1000);
        effect.tickPanorama(30_000); // 30 s in: still at rest
        expect(effect.renderSlice(400, 200, 100)).toBe(start);
        expect(effect.tickMs?.()).toBe(1000);
        effect.tickPanorama(15_000); // 45 s: the move starts any moment
        expect(effect.tickMs?.()).toBe(200);
        effect.tickPanorama(5_000); // 50 s: in the move
        const moving = effect.renderSlice(400, 200, 100);
        expect(moving).not.toBe(start);
        expect(effect.tickMs?.()).toBe(200);
        effect.tickPanorama(10_000); // 60 s: arrived
        const arrived = effect.renderSlice(400, 200, 100);
        expect(arrived).not.toBe(moving);
        effect.tickPanorama(5_000); // 65 s: resting again at the new view
        expect(effect.renderSlice(400, 200, 100)).toBe(arrived);
        expect(effect.tickMs?.()).toBe(1000);
    });

    it('starts every instance at a different point of its rest, so rows do not all move together', () => {
        const id = 'cccc1111dddd1111';
        const source = { kind: 'file' as const, id, name: 'wide.jpg', w: 1600, h: 200 };
        const settings = { source, fit: 'fill' as const, motion: 'zoom' as const, motionSeconds: 60 };
        const make = (jitter: number) => {
            motionJitter.next = () => jitter;
            const e = image.createInstance();
            e.initPanorama({ width: 800, height: 100, settings });
            return e;
        };
        const a = make(0);
        const b = make(0.9); // 0.9 of the 45 s rest = 40.5 s in
        expect(a.renderSlice(400, 200, 100)).toBe(b.renderSlice(400, 200, 100)); // both start at rest on the same view
        a.tickPanorama(5_000);
        b.tickPanorama(5_000);
        // 5 s later b has started its move, a is still resting
        expect(a.tickMs?.()).toBe(1000);
        expect(b.tickMs?.()).toBe(200);
        expect(a.renderSlice(400, 200, 100)).not.toBe(b.renderSlice(400, 200, 100));
    });

    it('keeps still with Fit', () => {
        const id = 'cccc1111dddd1111';
        const source = { kind: 'file' as const, id, name: 'wide.jpg', w: 1600, h: 200 };
        const still = image.createInstance();
        still.initPanorama({ width: 800, height: 100, settings: { source, fit: 'fit', motion: 'zoom' } });
        const before = still.renderSlice(400, 200, 100);
        still.tickPanorama(50_000);
        expect(still.renderSlice(400, 200, 100)).toBe(before);
        expect(still.tickMs?.()).toBe(1000);
    });
});

describe('engine tick speed', () => {
    it('lets an effect speed up and slow down after it started', async () => {
        vi.useFakeTimers();
        let wanted = 1000;
        const ticks: number[] = [];
        const def: EffectDefinition = {
            id: 'tick-test',
            displayName: 'Tick test',
            hidden: true,
            defaultSettings: {},
            settingsSchema: [],
            preferredTickMs: 1000,
            createInstance: () => ({ initPanorama() {}, tickPanorama: (dt) => void ticks.push(dt), renderSlice: () => '', tickMs: () => wanted }),
        };
        effectRegistry.set(def.id, def);
        try {
            const engine = new PanoramaEngine();
            engine.join('ctx-a', 'dev', 0, 'tick-test', {}, () => {});
            await vi.advanceTimersByTimeAsync(2000);
            const slow = ticks.length;
            expect(slow).toBeGreaterThan(0);
            expect(new Set(ticks)).toEqual(new Set([1000]));
            wanted = 100;
            await vi.advanceTimersByTimeAsync(1000); // the next tick asks for 100 ms
            ticks.length = 0;
            await vi.advanceTimersByTimeAsync(1000);
            expect(ticks.length).toBeGreaterThanOrEqual(9);
            expect(ticks.at(-1)).toBe(100);
            engine.leave('ctx-a');
        } finally {
            effectRegistry.delete(def.id);
        }
    });
});
