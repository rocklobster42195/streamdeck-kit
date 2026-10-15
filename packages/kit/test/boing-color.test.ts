import { describe, expect, it } from 'vitest';
import { glide, hexToRgb01, luminance, sameColor, separate } from '../src/panorama/effects/boing-color.js';
import boingBall from '../src/panorama/effects/boing-ball/index.js';
import boingGlobe from '../src/panorama/effects/boing-globe/index.js';

describe('boing colours', () => {
    it('keeps a colour that already differs enough', () => {
        const green = hexToRgb01('#87AE73');
        expect(separate(green, [1, 1, 1], 0.3)).toEqual(green);
    });

    it('darkens a pale colour away from white and lightens a blue away from the ocean', () => {
        const pale = separate(hexToRgb01('#F4F4F0'), [1, 1, 1], 0.3);
        expect(1 - luminance(pale)).toBeGreaterThanOrEqual(0.299);
        const ocean = hexToRgb01('#1C3E6C');
        const blue = separate(hexToRgb01('#2A4E80'), ocean, 0.25);
        expect(Math.abs(luminance(blue) - luminance(ocean))).toBeGreaterThanOrEqual(0.249);
        expect(blue.every((v) => v >= 0 && v <= 1)).toBe(true);
    });

    it('glides to a target and lands on it', () => {
        let c = hexToRgb01('#000000');
        const target = hexToRgb01('#FFFFFF');
        let steps = 0;
        while (!sameColor(c, target) && steps < 100) {
            c = glide(c, target);
            steps++;
        }
        expect(sameColor(c, target)).toBe(true);
        expect(steps).toBeGreaterThan(5);
        expect(steps).toBeLessThan(40);
    });

    it('the ball and the globe take a first colour at once and glide to later ones', () => {
        for (const def of [boingBall, boingGlobe]) {
            const key = def === boingBall ? 'primaryColor' : 'landColor';
            const inst = def.createInstance() as unknown as {
                initPanorama(ctx: unknown): void;
                onSettingsChange(s: unknown): void;
                tickPanorama(): void;
                renderSlice(x: number, w: number, h: number): string;
            };
            inst.initPanorama({ width: 200, height: 100, settings: { [key]: '#C0392B' } });
            const first = inst.renderSlice(0, 200, 100);
            inst.onSettingsChange({ [key]: '#2E86C1' });
            // Not a cut: the first picture after the change is still the old colour
            expect(inst.renderSlice(0, 200, 100)).toBe(first);
            for (let i = 0; i < 60; i++) inst.tickPanorama();
            expect(inst.renderSlice(0, 200, 100)).not.toBe(first);
        }
    });
});
