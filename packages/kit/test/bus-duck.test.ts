// deckbus ducking: the lease rules (fake timers) and one round trip over real pipes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeckBus, DuckLeases, parseDuck, serveDucking, type DuckChange } from '../src/bus/index.js';

const req = (by: number, extra: Partial<{ rampMs: number; maxMs: number }> = {}) => ({ target: 'meters/out', by, rampMs: 300, maxMs: 30_000, ...extra });

afterEach(() => vi.useRealTimers());

describe('parseDuck', () => {
    it('clamps and fills defaults', () => {
        expect(parseDuck({ target: 't', by: -12 })).toEqual({ target: 't', by: -12, rampMs: 300, maxMs: 30_000 });
        expect(parseDuck({ target: 't', by: -99, rampMs: 99_999, maxMs: 9_999_999 })).toEqual({ target: 't', by: -60, rampMs: 5000, maxMs: 300_000 });
        expect(parseDuck({ target: 't', by: 6, maxMs: 0 })).toMatchObject({ by: 0, maxMs: 30_000 });
    });

    it('rejects a missing target or a non-number', () => {
        expect(() => parseDuck({ by: -6 })).toThrow(/target/);
        expect(() => parseDuck({ target: 't', by: 'loud' })).toThrow(/by/);
    });
});

describe('DuckLeases', () => {
    it('the deepest duck wins; the level comes back when the last one ends', () => {
        const changes: DuckChange[] = [];
        const leases = new DuckLeases((c) => changes.push(c));
        leases.duck('a', req(-6));
        leases.duck('b', req(-12, { rampMs: 100 }));
        leases.unduck('b', 'meters/out');
        leases.unduck('a', 'meters/out');
        expect(changes.map((c) => [c.db, c.rampMs])).toEqual([[-6, 300], [-12, 100], [-6, 100], [0, 300]]);
    });

    it('a duck ends by itself after maxMs', () => {
        vi.useFakeTimers();
        const changes: DuckChange[] = [];
        const leases = new DuckLeases((c) => changes.push(c));
        leases.duck('a', req(-10, { maxMs: 1000 }));
        vi.advanceTimersByTime(999);
        expect(leases.depth('meters/out')).toBe(-10);
        vi.advanceTimersByTime(1);
        expect(leases.depth('meters/out')).toBe(0);
        expect(changes.at(-1)?.db).toBe(0);
    });

    it('a repeated duck from the same peer replaces its lease and restarts the time', () => {
        vi.useFakeTimers();
        const leases = new DuckLeases(() => {});
        leases.duck('a', req(-10, { maxMs: 1000 }));
        vi.advanceTimersByTime(800);
        leases.duck('a', req(-4, { maxMs: 1000 }));
        vi.advanceTimersByTime(800);
        expect(leases.depth('meters/out')).toBe(-4);
    });

    it('leave ends all of a peer\'s ducks; release forgets without a change', () => {
        const changes: DuckChange[] = [];
        const leases = new DuckLeases((c) => changes.push(c));
        leases.duck('a', req(-6));
        leases.duck('a', { ...req(-6), target: 'meters/app' });
        leases.leave('a');
        expect(leases.peers()).toEqual([]);
        expect(changes.filter((c) => c.db === 0).length).toBe(2);
        leases.duck('b', req(-6));
        const before = changes.length;
        leases.release('meters/out');
        expect(changes.length).toBe(before);
        expect(leases.depth('meters/out')).toBe(0);
    });
});

describe('serveDucking over the bus', () => {
    const buses: DeckBus[] = [];
    afterEach(() => {
        for (const b of buses.splice(0)) b.stop();
    });

    it('answers allowed peers, refuses others, and restores when the sender leaves', async () => {
        const namespace = `deckbus-test-${crypto.randomBytes(4).toString('hex')}`;
        const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deckbus-key-'));
        const make = (id: string) => {
            const b = new DeckBus({ id, name: id, version: '1', namespace, keyDir, scanMs: 50, slots: 4, timeoutMs: 500 });
            buses.push(b);
            return b;
        };
        const audio = make('audio');
        const friend = make('friend');
        const stranger = make('stranger');
        const changes: DuckChange[] = [];
        const leases = new DuckLeases((c) => changes.push(c));
        serveDucking(audio, leases, { allow: (p) => p.id === 'friend', has: (t) => t === 'meters/out' });
        await audio.start();
        await friend.start();
        await stranger.start();
        const until = async (check: () => boolean) => {
            const end = Date.now() + 3000;
            while (!check()) {
                if (Date.now() > end) throw new Error('timed out');
                await new Promise((r) => setTimeout(r, 10));
            }
        };
        await until(() => audio.peers().length === 2 && friend.peers().length === 2 && stranger.peers().length === 2);

        await expect(stranger.request('audio', 'duck', { target: 'meters/out', by: -12 })).rejects.toThrow('not allowed');
        await expect(friend.request('audio', 'duck', { target: 'meters/nope', by: -12 })).rejects.toThrow(/unknown target/);
        await expect(friend.request('audio', 'duck', { target: 'meters/out', by: -12 })).resolves.toEqual({ db: -12 });

        friend.stop();
        await until(() => leases.depth('meters/out') === 0);
        expect(changes.map((c) => c.db)).toEqual([-12, 0]);
    });
});
