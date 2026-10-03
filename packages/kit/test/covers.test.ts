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

    it('tells listeners only about real changes', () => {
        const board = new CoverBoard('SA-C');
        let calls = 0;
        board.onChange(() => calls++);
        board.setPeers([peer('MA-C', [entry('a', '#ff0000', true, 1)])]);
        board.setPeers([peer('MA-C', [entry('a', '#ff0000', true, 1)])]);
        expect(calls).toBe(1);
    });
});
