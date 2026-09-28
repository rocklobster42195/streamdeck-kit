import { describe, expect, it } from 'vitest';
import { deviceFrame } from '../src/render/device-frame.js';

describe('device frame', () => {
    it('frames a Stream Deck + screen with four knobs underneath', () => {
        const f = deviceFrame({ screenWidth: 824, screenHeight: 484, knobs: 4 });
        expect(f).toMatchObject({ width: 896, height: 676, screenX: 36, screenY: 36 });
        expect((f.svg.match(/r="40" fill="url\(#df-knob\)"/g) ?? []).length).toBe(4);
    });

    it('draws a keys-only deck without a knob row', () => {
        const f = deviceFrame({ screenWidth: 660, screenHeight: 504 });
        expect(f.height).toBe(504 + 72);
        expect(f.svg).not.toContain('df-knob)"/>');
    });
});
