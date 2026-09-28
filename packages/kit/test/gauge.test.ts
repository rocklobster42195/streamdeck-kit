import { describe, expect, it } from 'vitest';
import { arc } from '../src/render/gauge/arc.js';
import { pie } from '../src/render/gauge/pie.js';

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
