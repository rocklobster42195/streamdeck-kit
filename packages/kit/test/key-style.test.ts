import { describe, expect, it } from 'vitest';
import { KEY_ICON, keyActiveFrame, keyActivePlate, keyCaption, keySvg } from '../src/render/key-style.js';

describe('family key style', () => {
    it('draws "on" as a tinted plate and a rounded frame', () => {
        expect(keyActivePlate('#F7A600')).toContain('rx="18" fill="#F7A600" opacity="0.14"');
        expect(keyActiveFrame('#F7A600')).toContain('stroke="#F7A600" stroke-width="3"');
    });

    it('fits a caption, and cuts a long one with an ellipsis', () => {
        expect(keyCaption('1 min', '#fff')).toContain('font-size="28"');
        const long = keyCaption('Wohnzimmer Deckenlicht links hinten', '#fff');
        expect(keyCaption('Wohnzimmer', '#fff')).not.toContain('font-size="28"');
        expect(long).toContain('font-size="16"');
        expect(long).toContain('…');
    });

    it('keeps MA-C\'s icon sizes and builds an SVG data URI', () => {
        expect(KEY_ICON.full.size).toBe(112);
        expect(KEY_ICON.withCaption.size).toBe(92);
        expect(keySvg([]).startsWith('data:image/svg+xml;base64,')).toBe(true);
    });
});
