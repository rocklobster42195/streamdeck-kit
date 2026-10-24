import { describe, expect, it } from 'vitest';
import { effectRegistry } from '../src/panorama/registry.js';

// The dials of a row redraw on the group's tick: a plugin whose dial has a Panorama behind it redraws on the
// slice that arrives with the tick. A slow effect (2026-10-24: Colour and Image at 1 tick a second) makes the
// level meters and progress bars on those dials crawl.
describe('every effect ticks at least as often as the default (10 a second)', () => {
    for (const [id, def] of effectRegistry) {
        it(id, () => {
            expect(def.preferredTickMs ?? 100).toBeLessThanOrEqual(100);
            const instance = def.createInstance();
            instance.initPanorama({ width: 400, height: 100, settings: { ...def.defaultSettings } });
            expect(instance.tickMs?.() ?? 100).toBeLessThanOrEqual(100);
        });
    }
});
