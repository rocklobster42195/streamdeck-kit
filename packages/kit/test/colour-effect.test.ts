import { describe, expect, it } from 'vitest';
import colour from '../src/panorama/effects/colour/index.js';
import { effectRegistry, listEffects } from '../src/panorama/registry.js';

function make(settings: Record<string, unknown>, width = 600) {
    const effect = colour.createInstance();
    effect.initPanorama({ width, height: 100, settings });
    return effect;
}

describe('colour effect', () => {
    it('is registered and listed first', () => {
        expect(effectRegistry.has('colour')).toBe(true);
        expect(listEffects()[0].id).toBe('colour');
    });

    it('fills a slice with the one colour', () => {
        expect(make({ color: '#112233' }).renderSlice(0, 200, 100)).toBe('<rect width="200" height="100" fill="#112233"/>');
    });

    it('falls back to the default on a bad colour', () => {
        expect(make({ color: 'red' }).renderSlice(0, 200, 100)).toContain('fill="#87AE73"');
    });

    it('lets one gradient run over the whole row, each slice seeing its part', () => {
        const effect = make({ color: '#FFFFFF', fade: true, fadeAmount: 100 }, 600);
        const second = effect.renderSlice(200, 200, 100);
        expect(second).toContain('x1="-200"');
        expect(second).toContain('x2="400"');
        expect(second).toContain('stop-color="#FFFFFF"');
        expect(second).toContain('stop-color="#000000"');
    });

    it('follows a settings change and a changed row width', () => {
        const effect = make({ color: '#000000' });
        effect.onSettingsChange?.({ color: '#FFFFFF', fade: true, fadeAmount: 50 });
        effect.initPanorama({ width: 400, height: 100, settings: { color: '#FFFFFF', fade: true, fadeAmount: 50 } });
        expect(effect.renderSlice(0, 200, 100)).toContain('x2="400"');
    });
});
