import { describe, expect, it } from 'vitest';
import { renderTrackDial } from '../src/render/track-dial.js';
import { renderVolumeDial } from '../src/render/volume-dial.js';
import { flatUnderlay, isFlat } from '../src/render/strip.js';

const svgOf = (uri: string) => Buffer.from(uri.split(',')[1], 'base64').toString('utf-8');
/** How many soft dark shapes (scrims) a dial drew. */
const scrims = (uri: string) => (svgOf(uri).match(/fill="#000" opacity="0\.5"/g) ?? []).length;

const underlay = '<rect width="200" height="100" fill="#336699"/>';

describe('soft backing on a Panorama', () => {
    it('is drawn behind a volume dial by default and left out when the slice is flat', () => {
        const base = { volume: 40, name: 'Kitchen', gauge: 'ring' as const, color: '#87AE73', mutedLabel: 'MUTED' };
        expect(scrims(renderVolumeDial({ ...base, underlay } as never))).toBeGreaterThan(0);
        expect(scrims(renderVolumeDial({ ...base, underlay: flatUnderlay(underlay) } as never))).toBe(0);
        // The picture itself stays
        expect(svgOf(renderVolumeDial({ ...base, underlay: flatUnderlay(underlay) } as never))).toContain('#336699');
    });

    it('is left out of a track dial on a flat slice too', () => {
        const base = { playing: true, title: 'A title', artist: 'An artist', accent: '#87AE73', nothing: '' };
        expect(scrims(renderTrackDial({ ...base, underlay } as never))).toBeGreaterThan(0);
        expect(scrims(renderTrackDial({ ...base, underlay: flatUnderlay(underlay) } as never))).toBe(0);
    });

    it('is recognised on a marked slice only', () => {
        expect(isFlat(underlay)).toBe(false);
        expect(isFlat(undefined)).toBe(false);
        expect(isFlat(flatUnderlay(underlay))).toBe(true);
        expect(flatUnderlay('')).toBe('');
    });
});
