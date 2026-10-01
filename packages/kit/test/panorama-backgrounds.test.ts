import { describe, expect, it } from 'vitest';
import type { PeerInfo } from '../src/bus/bus.js';
import { resolveBackgrounds } from '../src/panorama/backgrounds.js';

const peer = (name: string, actions: unknown[]): PeerInfo => ({ id: `id.${name}`, name, version: '1', caps: [], slot: 0, protocol: 1, state: { actions } }) as unknown as PeerInfo;
const dial = (context: string, column: number, background?: string) => ({ context, device: 'D', column, background });

describe('dial backgrounds', () => {
    it('takes the effect of another plugin\'s dial next to it and spreads along the row', () => {
        const peers = [peer('MA-C', [{ device: 'D', column: 0, row: 0, controller: 'Encoder', action: 'x', effect: 'particles' }])];
        const out = resolveBackgrounds([dial('a', 1), dial('b', 2), dial('c', 3, 'none')], peers);
        expect([...out]).toEqual([['c', undefined], ['a', 'particles'], ['b', 'particles']]);
    });

    it('keeps a chosen effect and shows none without neighbours', () => {
        const out = resolveBackgrounds([dial('a', 0, 'matrix-rain'), dial('b', 2)], []);
        expect(out.get('a')).toBe('matrix-rain');
        expect(out.get('b')).toBeUndefined();
    });

    it('takes the right neighbour when the left one has none', () => {
        const out = resolveBackgrounds([dial('a', 1), dial('b', 2, 'boing-ball')], []);
        expect(out.get('a')).toBe('boing-ball');
    });
});
