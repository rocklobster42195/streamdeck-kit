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
        expect(marqueeOffset(200, 0, 2500, 40, 1500)).toBeCloseTo(40);
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
