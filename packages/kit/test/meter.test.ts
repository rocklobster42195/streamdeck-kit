import { describe, expect, it } from 'vitest';
import { meterBar } from '../src/render/gauge/bar.js';
import { MeterBallistics, VuBallistics } from '../src/render/gauge/peak.js';
import { scalePosition, zoneColor } from '../src/render/gauge/scale.js';
import { dbfsToVu, vuMeter, vuPosition } from '../src/render/gauge/vu.js';

describe('meter scale', () => {
    it('maps dBFS to 0..1 with more room at the top', () => {
        expect(scalePosition(-60)).toBe(0);
        expect(scalePosition(-20)).toBe(0.5);
        expect(scalePosition(0)).toBe(1);
        expect(scalePosition(-100)).toBe(0);
        expect(scalePosition(6)).toBe(1);
        expect(scalePosition(Number.NaN)).toBe(0);
    });

    it('picks zone colours: green, yellow from -18, red from -6', () => {
        expect(zoneColor(-30)).toBe('#3ddc84');
        expect(zoneColor(-18)).toBe('#f5c542');
        expect(zoneColor(-6)).toBe('#ff4d4d');
    });
});

describe('meter bars', () => {
    const lit = (parts: string[], off = '#23262b') => parts.filter((p) => !p.includes(off)).length;

    it('draws one bar for mono and two for stereo', () => {
        const mono = meterBar({ x: 0, y: 0, length: 100, thickness: 20, levels: [-20], segments: 10 });
        const stereo = meterBar({ x: 0, y: 0, length: 100, thickness: 20, levels: [-20, -20], segments: 10 });
        expect(mono).toHaveLength(10);
        expect(stereo).toHaveLength(20);
    });

    it('lights segments up to the level and adds a peak line', () => {
        const parts = meterBar({ x: 0, y: 0, length: 100, thickness: 10, levels: [-20], peaks: [-6], segments: 10 });
        expect(lit(parts.slice(0, 10))).toBe(5); // -20 dB = half the scale
        expect(parts).toHaveLength(11);
    });

    it('stands up: segments grow from the bottom', () => {
        const [first] = meterBar({ x: 0, y: 0, length: 100, thickness: 10, levels: [0], segments: 10, orientation: 'vertical', gap: 0 });
        expect(first).toContain('y="90.0"');
    });
});

describe('ballistics', () => {
    it('digital: rises at once, falls at the release rate, holds the peak', () => {
        const m = new MeterBallistics(20, 1500);
        expect(m.update(-10, 1000)).toEqual({ level: -10, peak: -10 });
        const s = m.update(-60, 1500); // 0.5 s later: fell 10 dB, peak held
        expect(s.level).toBeCloseTo(-20);
        expect(s.peak).toBe(-10);
        const later = m.update(-60, 3000); // hold over: the peak falls too
        expect(later.peak).toBeLessThan(-10);
    });

    it('VU: reaches ~99% of a step after 300 ms', () => {
        const vu = new VuBallistics(300);
        vu.update(-20, 0);
        expect(vu.update(0, 150)).toBeGreaterThan(-5);
        expect(vu.update(0, 300)).toBeGreaterThan(-0.3);
    });

    it('VU scale: 0 VU = -18 dBFS by default, classic printed positions', () => {
        expect(dbfsToVu(-18)).toBe(0);
        expect(vuPosition(0)).toBeCloseTo(0.77);
        expect(vuPosition(-30)).toBe(0);
        expect(vuMeter({ x: 0, y: 0, width: 90, height: 80, vu: 0, id: 'a' }).join('')).toContain('id="a-face"');
    });
});
