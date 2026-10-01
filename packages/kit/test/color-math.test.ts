import { describe, expect, it } from 'vitest';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex } from '../src/pi/color-math.js';

describe('colour conversions', () => {
    it('normalises hex input', () => {
        expect(normalizeHex('#f7a600')).toBe('#F7A600');
        expect(normalizeHex('F7A600')).toBe('#F7A600');
        expect(normalizeHex('#fa0')).toBe('#FFAA00');
        expect(normalizeHex(' #005da0 ')).toBe('#005DA0');
        expect(normalizeHex('auto')).toBeUndefined();
        expect(normalizeHex('#12345')).toBeUndefined();
    });

    it('converts between hex and RGB', () => {
        expect(hexToRgb('#E30018')).toEqual({ r: 227, g: 0, b: 24 });
        expect(rgbToHex({ r: 0, g: 93, b: 160 })).toBe('#005DA0');
        expect(rgbToHex({ r: 300, g: -4, b: 12.6 })).toBe('#FF000D');
    });

    it('goes round through HSV without drifting', () => {
        for (const hex of ['#E30018', '#009FDF', '#FFFFFF', '#000000', '#A5A5A5', '#59A028', '#005DA0', '#993386', '#F7A600', '#AFCA05', '#00ACA8', '#E14190', '#FFDD00']) {
            expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
        }
        expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
        expect(hexToHsv('#0000FF')!.h).toBe(240);
    });
});
