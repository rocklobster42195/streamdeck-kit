import { describe, expect, it } from 'vitest';
import { KEY_ICON, keyActiveFrame, keyActivePlate, keyCaption, keyLabel, keySvg } from '../src/render/key-style.js';

describe('family key style', () => {
    it('draws "on" as a tinted plate and a rounded frame', () => {
        expect(keyActivePlate('#F7A600')).toContain('rx="18" fill="#F7A600" opacity="0.14"');
        expect(keyActiveFrame('#F7A600')).toContain('stroke="#F7A600" stroke-width="3"');
    });

    it('fits a caption, and cuts a long one with an ellipsis', () => {
        expect(keyCaption('1 min', '#fff')).toContain('font-size="24"');
        const long = keyCaption('Wohnzimmer Deckenlicht links hinten', '#fff');
        expect(keyCaption('Wohnzimmer', '#fff')).not.toContain('font-size="24"');
        expect(long).toContain('font-size="16"');
        expect(long).toContain('…');
    });

    it('has one symbol size, a little smaller with a caption, smaller ones for more text, and builds an SVG data URI', () => {
        expect(KEY_ICON.full.size).toBe(96);
        expect(KEY_ICON.withCaption.size).toBe(80);
        expect(KEY_ICON.compact.size).toBe(60);
        expect(KEY_ICON.twoLines.size).toBe(60);
        // The icon and a caption under it do not touch: the icon ends above where the caption's letters start
        expect(KEY_ICON.withCaption.y + KEY_ICON.withCaption.size).toBeLessThan(144 - 16 - 24 * 0.75);
        expect(keySvg([]).startsWith('data:image/svg+xml;base64,')).toBe(true);
    });

    it('puts a short name on one line under the icon', () => {
        const short = keyLabel('Wandlampen', '#fff');
        expect(short.place).toBe(KEY_ICON.withCaption);
        expect((short.svg.match(/<text/g) ?? []).length).toBe(1);
        expect(keyLabel('Bad', '#fff').svg).toContain('font-size="24"');
    });

    it('breaks a long name with a space onto two lines and makes the icon smaller and higher', () => {
        const two = keyLabel('Wohnzimmer Stehlampe Ecke', '#fff');
        expect(two.place).toBe(KEY_ICON.twoLines);
        expect((two.svg.match(/<text/g) ?? []).length).toBe(2);
        expect(two.svg).toContain('Wohnzimmer');
        // The text stays below the smaller icon
        expect(KEY_ICON.twoLines.y + KEY_ICON.twoLines.size).toBeLessThan(100 - 20 * 0.75);
        // Two words that fit on one line stay on one
        expect(keyLabel('Bad oben', '#fff').place).toBe(KEY_ICON.withCaption);
    });

    it('keeps a long word on one line, shrunk and then cut', () => {
        const word = keyLabel('Schreibtischlampenschalter', '#fff');
        expect(word.place).toBe(KEY_ICON.withCaption);
        expect((word.svg.match(/<text/g) ?? []).length).toBe(1);
        expect(word.svg).toContain('…');
    });
});
