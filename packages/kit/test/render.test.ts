import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedValue, FrameTicker } from '../src/render/animation.js';
import { marqueeNeeded, marqueeOffset, marqueeSvg } from '../src/render/marquee.js';
import { measureArialWidth, wrapToWidth } from '../src/render/text-width.js';

describe('wrapToWidth', () => {
    it('wraps by measured width and ellipsizes the last line', () => {
        const lines = wrapToWidth('Grateful Dead Live at Barton Hall, Cornell University on 1977-05-08', 13, 112, 2);
        expect(lines).toHaveLength(2);
        for (const l of lines) expect(measureArialWidth(l, 13)).toBeLessThanOrEqual(112);
        expect(lines[1].endsWith('…')).toBe(true);
    });
    it('keeps short text on one line', () => {
        expect(wrapToWidth('Loser', 13, 112)).toEqual(['Loser']);
    });
});

describe('marquee', () => {
    it('only scrolls when the text does not fit', () => {
        expect(marqueeNeeded('Loser', 13, 100)).toBe(false);
        expect(marqueeNeeded('They Love Each Other (live at Cornell 1977)', 13, 100)).toBe(true);
        expect(marqueeSvg({ id: 'a', text: 'Loser', x: 0, y: 10, width: 100, fontSize: 13, startedAt: 0, now: 5000 })).not.toContain('mask');
    });
    it('pauses at the start of each loop, then moves at the given speed', () => {
        expect(marqueeOffset(200, 0, 1000, 40, 1500)).toBe(0);
        expect(marqueeOffset(200, 0, 2500, 40, 1500, 100)).toBeCloseTo(40);
    });
    it('moves in whole ticks, so every frame shifts the text by the same amount', () => {
        // 25 px/s at 80 ms ticks = 2 px per tick; late or early frames land on the same grid
        const at = (ms: number) => marqueeOffset(300, 0, 1500 + ms, 25, 1500, 80);
        expect([at(0), at(79), at(80), at(159), at(160), at(241)]).toEqual([0, 0, 2, 2, 4, 6]);
    });
});

describe('AnimatedValue', () => {
    it('eases from the current value to a new target', () => {
        let now = 0;
        const v = new AnimatedValue(10, 200, () => now);
        v.set(20);
        expect(v.value()).toBe(10);
        now = 100;
        expect(v.value()).toBeGreaterThan(15);
        expect(v.animating).toBe(true);
        now = 200;
        expect(v.value()).toBe(20);
        expect(v.animating).toBe(false);
    });
});

describe('FrameTicker', () => {
    afterEach(() => vi.useRealTimers());
    it('runs frames until they report rest, then stops its interval', async () => {
        vi.useFakeTimers();
        const t = new FrameTicker(100);
        let frames = 0;
        t.run('x', () => ++frames < 3);
        expect(t.running).toBe(true);
        await vi.advanceTimersByTimeAsync(500);
        expect(frames).toBe(3);
        expect(t.running).toBe(false);
    });
});

describe('MarqueeStepper', () => {
    it('moves in whole pixels at a fixed rhythm, slow speeds every few ticks', async () => {
        const { MarqueeStepper } = await import('../src/render/marquee.js');
        const slow = new MarqueeStepper(1000 / 150, 0, 80); // 1 px per 150 ms ≈ 0.53 px per 80 ms tick
        const seen: number[] = [];
        for (let i = 0; i < 8; i++) {
            seen.push(slow.offset(300));
            slow.tick();
        }
        expect(seen).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
        const fast = new MarqueeStepper(25, 0, 80); // 2 px per tick
        fast.tick();
        fast.tick();
        expect(fast.offset(300)).toBe(4);
    });

    it('pauses at the start of every loop and restarts on reset', async () => {
        const { MarqueeStepper } = await import('../src/render/marquee.js');
        const m = new MarqueeStepper(25, 160, 80); // two pause ticks
        m.tick();
        expect(m.offset(100)).toBe(0);
        m.tick();
        m.tick();
        expect(m.offset(100)).toBe(2);
        m.reset();
        expect(m.offset(100)).toBe(0);
    });
});

describe('nowPlayingCard', () => {
    it('shows the source when there is one, else title and artist, always the hint', async () => {
        const { nowPlayingCard } = await import('../src/render/now-playing-card.js');
        const dec = (u: string) => Buffer.from(u.split(',')[1], 'base64').toString();
        const src = dec(nowPlayingCard({ title: 'T', source: { kind: 'Playlist', name: 'Evening', track: 'Song · Band' }, hint: 'Turn' }));
        expect(src).toContain('Evening');
        expect(src).toContain('Turn');
        const plain = dec(nowPlayingCard({ title: 'Song', artist: 'Band', hint: 'Turn', cover: 'data:image/png;base64,AA' }));
        expect(plain).toContain('Band');
        expect(plain).toContain('data:image/png;base64,AA');
    });
});
