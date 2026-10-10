import { describe, expect, it } from 'vitest';
import type { PeerInfo } from '../src/bus/bus.js';
import { CoverBoard, type CoverEntry } from '../src/panorama/covers.js';

const peer = (name: string, covers: CoverEntry[]): PeerInfo => ({ id: `id.${name}`, name, version: '1', caps: [], slot: 0, protocol: 1, state: { covers } }) as unknown as PeerInfo;
const entry = (player: string, color: string, playing: boolean, since: number): CoverEntry => ({ player, name: player, color, playing, since });

describe('cover board', () => {
    it('active = the player that started playing last, else the one that played last', () => {
        const board = new CoverBoard('SA-C');
        board.setPeers([peer('MA-C', [entry('kitchen', '#ff0000', true, 10), entry('bath', '#00ff00', true, 20)]), peer('SO-C', [entry('office', '#0000ff', false, 30)])]);
        expect(board.resolve('cover')).toBe('#00ff00');
        expect(board.resolve(undefined)).toBe('#00ff00');
        board.setPeers([peer('SO-C', [entry('office', '#0000ff', false, 30), entry('den', '#ffff00', false, 5)])]);
        expect(board.resolve('cover')).toBe('#0000ff');
    });

    it('"cover" is the active speaker, "cover-all" the active player with apps; a PC without speakers follows its apps', () => {
        const board = new CoverBoard('SA-C');
        const app = { ...entry('firefox', '#e8b569', true, 50), kind: 'app' };
        board.setPeers([peer('SO-C', [{ ...entry('RINCON_1', '#72a9bf', true, 10), kind: 'speaker' }]), peer('SA-C', [app])]);
        expect(board.resolve('cover')).toBe('#72a9bf');
        expect(board.resolve('cover-all')).toBe('#e8b569');
        board.setPeers([peer('SA-C', [app])]);
        expect(board.resolve('cover')).toBe('#e8b569');
    });

    it('one player by plugin and id, a fixed colour, or none', () => {
        const board = new CoverBoard('MA-C');
        board.publish([entry('kitchen', '#ff0000', false, 1)]);
        board.setPeers([peer('SO-C', [entry('kitchen', '#0000ff', true, 2)])]);
        expect(board.resolve('cover:MA-C/kitchen')).toBe('#ff0000');
        expect(board.resolve('cover:SO-C/kitchen')).toBe('#0000ff');
        expect(board.resolve('cover:SO-C/gone')).toBeUndefined();
        expect(board.resolve('#123456')).toBe('#123456');
        expect(board.resolve('default')).toBeUndefined();
        expect(board.sources().map((s) => s.id)).toEqual(['MA-C/kitchen', 'SO-C/kitchen']);
    });

    it('one device known to two plugins counts once, with the direct plugin’s colour', () => {
        const board = new CoverBoard('SA-C');
        board.setPeers([
            peer('MA-C', [{ ...entry('ma-bad', '#d09c87', true, 9), device: 'RINCON_1' }]),
            peer('SO-C', [{ ...entry('RINCON_1', '#72a9bf', true, 5), device: 'RINCON_1', direct: true }]),
        ]);
        expect(board.sources().map((s) => s.id)).toEqual(['SO-C/RINCON_1']);
        expect(board.resolve('cover')).toBe('#72a9bf');
    });

    it('tells listeners only about real changes', () => {
        const board = new CoverBoard('SA-C');
        let calls = 0;
        board.onChange(() => calls++);
        board.setPeers([peer('MA-C', [entry('a', '#ff0000', true, 1)])]);
        board.setPeers([peer('MA-C', [entry('a', '#ff0000', true, 1)])]);
        expect(calls).toBe(1);
    });
});

describe('readable cover colour', () => {
    it('raises dark and pale colours, keeps bright ones and greys', async () => {
        const { readableCoverColor } = await import('../src/panorama/covers.js');
        expect(readableCoverColor([255, 0, 0])).toBe('#ff0000');
        const dark = readableCoverColor([40, 10, 10]);
        expect(parseInt(dark.slice(1, 3), 16)).toBeGreaterThanOrEqual(190);
        expect(readableCoverColor([200, 190, 190]).slice(1, 3)).toBe('c8');
        expect(readableCoverColor([50, 50, 50])).toBe('#bfbfbf');
        // A near-grey stays near-grey instead of turning salmon
        const pale = readableCoverColor([208, 203, 201]);
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(pale.slice(i, i + 2), 16));
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20);
    });
});
