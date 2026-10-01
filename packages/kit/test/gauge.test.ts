import { describe, expect, it } from 'vitest';
import { arc } from '../src/render/gauge/arc.js';
import { pie } from '../src/render/gauge/pie.js';
import { halfArc, halfArcPosition } from '../src/render/gauge/half-arc.js';

describe('pie', () => {
    it('draws only the outline at 0 and for invalid values', () => {
        expect(pie(12, 12, 9, 0, '#fff')).toHaveLength(1);
        expect(pie(12, 12, 9, Number.NaN, '#fff')).toHaveLength(1);
        expect(pie(12, 12, 9, -0.2, '#fff')).toHaveLength(1);
    });

    it('fills the inner circle at 100 % and above', () => {
        const parts = pie(12, 12, 9, 1.5, '#fff', { inner: 7, stroke: 1.5 });
        expect(parts[1]).toBe('<circle cx="12" cy="12" r="7" fill="#fff"/>');
    });

    it('matches Sonos Controller geometry on keys', () => {
        expect(pie(12, 12, 9, 0.42, '#abc', { inner: 7, stroke: 1.5 })[0]).toBe('<circle cx="12" cy="12" r="9" fill="none" stroke="#abc" stroke-width="1.5"/>');
    });

    it('uses the large-arc flag past half', () => {
        expect(pie(12, 12, 9, 0.75, '#fff', { inner: 7 })[1]).toMatch(/A 7 7 0 1 1/);
        expect(pie(12, 12, 9, 0.25, '#fff', { inner: 7 })[1]).toMatch(/A 7 7 0 0 1/);
    });

    it('ends the wedge at 3 o\'clock for a quarter', () => {
        expect(pie(50, 50, 38, 0.25, '#fff', { inner: 30 })[1]).toContain('80.00 50.00 Z');
    });

    it("derives Sonos Controller's inner radius and stroke from the outer radius", () => {
        expect(pie(50, 50, 38, 0.5, '#fff')[0]).toContain('stroke-width="6"');
        expect(pie(12, 12, 9, 0.5, '#fff')[0]).toContain('stroke-width="1.5"');
        expect(pie(50, 50, 38, 1, '#fff')[1]).toContain('r="30"');
        expect(pie(12, 12, 9, 1, '#fff')[1]).toContain('r="7"');
    });
});

describe('arc', () => {
    it('draws only the track at 0', () => {
        expect(arc(72, 72, 54, 0, '#6cc4ff')).toHaveLength(1);
    });

    it('draws a dashed arc proportional to the value', () => {
        const parts = arc(72, 72, 54, 0.5, '#6cc4ff', { width: 14 });
        const c = 2 * Math.PI * 54;
        expect(parts[1]).toContain(`stroke-dasharray="${(c / 2).toFixed(1)} ${c.toFixed(1)}"`);
        expect(parts[1]).toContain('stroke-width="14"');
    });
});

describe('halfArc', () => {
    const base = { cx: 72, cy: 100, r: 50, min: 10, max: 30 };

    it('draws only the track without value, target or zones', () => {
        const parts = halfArc(base);
        expect(parts).toHaveLength(1);
        expect(parts[0]).toContain('M 22.00 100.00 A 50 50 0 0 1 122.00 100.00');
    });

    it('fills from the left end to the value, at the top for the middle', () => {
        const parts = halfArc({ ...base, value: 20, color: '#abc' });
        expect(parts[1]).toContain('A 50 50 0 0 1 72.00 50.00');
        expect(parts[1]).toContain('stroke="#abc"');
    });

    it('clamps values outside the range and skips the fill at the minimum', () => {
        expect(halfArc({ ...base, value: 5 })).toHaveLength(1);
        expect(halfArc({ ...base, value: 99 })[1]).toContain('122.00 100.00');
    });

    it('draws zone bands and fills in the zone of the value', () => {
        const zones = [
            { from: -Infinity, color: '#0000ff' },
            { from: 18, color: '#00ff00' },
            { from: 22, color: '#ff0000' },
        ];
        const parts = halfArc({ ...base, value: 25, zones });
        expect(parts.filter((p) => p.includes('opacity="0.35"'))).toHaveLength(3);
        expect(parts[4]).toContain('stroke="#ff0000"');
        expect(parts[4]).not.toContain('opacity');
    });

    it('adds a marker for the target', () => {
        const parts = halfArc({ ...base, target: 20 });
        expect(parts).toHaveLength(4);
        expect(parts[3]).toMatch(/^<path d="M 72.00 42.00/);
    });

    it('maps positions', () => {
        expect(halfArcPosition(20, 10, 30)).toBe(0.5);
        expect(halfArcPosition(5, 10, 30)).toBe(0);
        expect(halfArcPosition(5, 10, 10)).toBe(0);
    });
});
