import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerBoard, renderPlaybackKey, renderVolumeKey } from '../src/index.js';

afterEach(() => vi.useRealTimers());

function board(busy = false) {
    const b = new PlayerBoard('T');
    b.publish([{ player: 'p', device: 'RINCON_X', name: 'Küche', kind: 'speaker', playing: true, since: 1, can: ['next', 'play-pause'], ...(busy ? { busy: true } : {}) }]);
    return b;
}

describe('player status in a corner', () => {
    it('a command that takes a while shows as loading, then goes away', async () => {
        vi.useFakeTimers();
        const b = board();
        let done!: () => void;
        b.serve(() => new Promise<void>((r) => (done = r)));
        const p = b.resolve('device:RINCON_X')!;
        const sent = b.send(p, 'next');
        expect(b.status(p)).toBeUndefined();
        await vi.advanceTimersByTimeAsync(700);
        expect(b.status(p)).toBe('loading');
        done();
        await sent;
        expect(b.status(p)).toBeUndefined();
    });

    it('a quick command never shows', async () => {
        vi.useFakeTimers();
        const b = board();
        b.serve(async () => undefined);
        const p = b.resolve('device:RINCON_X')!;
        await b.send(p, 'next');
        await vi.advanceTimersByTimeAsync(800);
        expect(b.status(p)).toBeUndefined();
    });

    it('a refused command shows as failed for a few seconds', async () => {
        vi.useFakeTimers();
        const b = board();
        b.serve(async () => {
            throw new Error('nope');
        });
        const p = b.resolve('device:RINCON_X')!;
        await expect(b.send(p, 'next')).rejects.toThrow('nope');
        expect(b.status(p)).toBe('failed');
        await vi.advanceTimersByTimeAsync(4100);
        expect(b.status(p)).toBeUndefined();
    });

    it('a player whose plugin says it is busy shows as loading on every key', () => {
        const b = board(true);
        const p = b.resolve('device:RINCON_X')!;
        expect(p.busy).toBe(true);
        expect(b.status(p)).toBe('loading');
    });

    it('the keys draw the badge', () => {
        const plain = renderVolumeKey({ command: 'up', volume: 30, muted: false, preset: 20, showVolume: true, gauge: 'ring', color: '#ccc' });
        const loading = renderVolumeKey({ command: 'up', volume: 30, muted: false, preset: 20, showVolume: true, gauge: 'ring', color: '#ccc', status: 'loading' });
        expect(loading).not.toBe(plain);
        expect(renderPlaybackKey({ icon: 'M0 0', color: '#fff', status: 'failed' })).not.toBe(renderPlaybackKey({ icon: 'M0 0', color: '#fff' }));
    });
});
