// deckbus over real pipes (Windows) or Unix sockets, each test in its own namespace and key dir.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DeckBus, type DeckBusOptions } from '../src/bus/index.js';

const buses: DeckBus[] = [];
let namespace = '';
let keyDir = '';

function bus(id: string, extra: Partial<DeckBusOptions> = {}): DeckBus {
    const b = new DeckBus({ id, name: id.toUpperCase(), version: '1.0.0', namespace, keyDir, scanMs: 50, slots: 4, timeoutMs: 300, ...extra });
    buses.push(b);
    return b;
}

const until = async (check: () => boolean, ms = 3000) => {
    const end = Date.now() + ms;
    while (!check()) {
        if (Date.now() > end) throw new Error('timed out');
        await new Promise((r) => setTimeout(r, 10));
    }
};

function fresh() {
    namespace = `deckbus-test-${crypto.randomBytes(4).toString('hex')}`;
    keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deckbus-key-'));
}

afterEach(() => {
    for (const b of buses.splice(0)) b.stop();
});

describe('deckbus', () => {
    it('peers find each other in any start order and take the free slots', async () => {
        fresh();
        const a = bus('a');
        const b = bus('b');
        const c = bus('c');
        await c.start();
        await a.start();
        await b.start();
        expect([c.slot, a.slot, b.slot]).toEqual([0, 1, 2]);
        await until(() => a.peers().length === 2 && b.peers().length === 2 && c.peers().length === 2);
        expect(a.peers().map((p) => p.id).sort()).toEqual(['b', 'c']);
        expect(a.peers()[0].protocol).toBe(1);
    });

    it('shares soft state, again after a reconnect, and forgets it when a peer leaves', async () => {
        fresh();
        const a = bus('a');
        const b = bus('b');
        await a.start();
        a.setState('status', { online: true });
        await b.start();
        await until(() => (b.peers()[0]?.state.status as { online?: boolean })?.online === true);
        a.setState('status', { online: false });
        await until(() => (b.peers()[0]?.state.status as { online?: boolean })?.online === false);
        a.stop();
        await until(() => b.peers().length === 0);
        const a2 = bus('a');
        await a2.start();
        a2.setState('status', { online: true, again: 1 });
        await until(() => (b.peers()[0]?.state.status as { again?: number })?.again === 1);
    });

    it('sends stream data only to subscribers and reports their number', async () => {
        fresh();
        const pub = bus('xrc');
        const sub = bus('mac');
        await pub.start();
        await sub.start();
        await until(() => pub.peers().length === 1);
        const counts: number[] = [];
        pub.onSubscribers('meters/ch09', (n) => counts.push(n));
        const got: unknown[] = [];
        const off = sub.subscribe('meters/ch09', (data, from) => got.push([data, from.id]));
        await until(() => counts.at(-1) === 1);
        pub.publish('meters/ch09', { l: -18.5, r: -20.1 });
        pub.publish('meters/other', { l: 0 });
        await until(() => got.length === 1);
        expect(got[0]).toEqual([{ l: -18.5, r: -20.1 }, 'xrc']);
        off();
        await until(() => counts.at(-1) === 0);
        expect(counts).toEqual([0, 1, 0]);
    });

    it('answers requests only for allowed peers, and times out', async () => {
        fresh();
        const xrc = bus('xrc');
        const mac = bus('mac');
        await xrc.start();
        await mac.start();
        await until(() => mac.peers().length === 1);
        xrc.handle('duck', (params) => ({ ducked: (params as { by: number }).by }), (peer) => peer.id === 'mac');
        xrc.handle('secret', () => 42, () => false);
        xrc.handle('slow', () => new Promise((r) => setTimeout(r, 1000)), () => true);
        await expect(mac.request('xrc', 'duck', { by: -12 })).resolves.toEqual({ ducked: -12 });
        await expect(mac.request('xrc', 'secret')).rejects.toThrow('not allowed');
        await expect(mac.request('xrc', 'nothing')).rejects.toThrow('unknown method');
        await expect(mac.request('xrc', 'slow')).rejects.toThrow('no answer');
        await expect(mac.request('nobody', 'duck')).rejects.toThrow('no peer');
    });

    it('broadcasts to everyone', async () => {
        fresh();
        const a = bus('a');
        const b = bus('b');
        const c = bus('c');
        for (const x of [a, b, c]) await x.start();
        await until(() => a.peers().length === 2);
        const heard: string[] = [];
        b.onBroadcast('alert', (d, from) => heard.push(`b:${(d as { text: string }).text}:${from.id}`));
        c.onBroadcast('alert', (d, from) => heard.push(`c:${(d as { text: string }).text}:${from.id}`));
        await until(() => b.peers().length === 2 && c.peers().length === 2);
        a.broadcast('alert', { text: 'Doorbell' });
        await until(() => heard.length === 2);
        expect(heard.sort()).toEqual(['b:Doorbell:a', 'c:Doorbell:a']);
    });

    it('keeps out peers with another key or without a common protocol version', async () => {
        fresh();
        const a = bus('a');
        await a.start();
        const stranger = bus('stranger', { keyDir: fs.mkdtempSync(path.join(os.tmpdir(), 'deckbus-other-')) });
        const future = bus('future', { protocolVersions: [2] });
        await stranger.start();
        await future.start();
        await new Promise((r) => setTimeout(r, 300));
        expect(a.peers()).toEqual([]);
        expect(stranger.peers()).toEqual([]);
        expect(future.peers()).toEqual([]);
    });
});
