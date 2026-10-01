import { describe, expect, it } from 'vitest';
import { openRing, openRingPoint } from '../src/render/gauge/open-ring.js';

const zones = [{ from: -Infinity, color: '#F7A600' }, { from: 22, color: '#E30018' }];

describe('open ring gauge', () => {
    it('runs from bottom left over the top to bottom right', () => {
        const [x0, y0] = openRingPoint(100, 50, 40, 0);
        const [xm, ym] = openRingPoint(100, 50, 40, 0.5);
        const [x1, y1] = openRingPoint(100, 50, 40, 1);
        expect(x0).toBeLessThan(100);
        expect(y0).toBeGreaterThan(50);
        expect(Math.round(xm)).toBe(100);
        expect(Math.round(ym)).toBe(10);
        expect(x1).toBeGreaterThan(100);
        expect(y1).toBeCloseTo(y0, 5);
    });

    it('fills up to the value in its zone colour, with handle and dot', () => {
        const parts = openRing({ cx: 100, cy: 50, r: 40, min: 0, max: 30, value: 24, dot: 20, zones, handle: true });
        expect(parts.join('')).toContain('stroke="#E30018"');
        expect(parts.filter((p) => p.startsWith('<circle'))).toHaveLength(2);
    });

    it('is grey and empty while dimmed', () => {
        const parts = openRing({ cx: 100, cy: 50, r: 40, min: 0, max: 100, value: 40, zones, handle: true, dim: true });
        expect(parts.join('')).not.toContain('#F7A600');
        expect(parts.join('')).toContain('fill="#8a8a90"');
    });
});
