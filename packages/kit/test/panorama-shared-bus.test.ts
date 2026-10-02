// The shared Panorama over a real deckbus (pipes on Windows, Unix sockets elsewhere): one plugin
// leads, the other gets its dial's slices over the bus.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionsState, DeckBus } from '../src/bus/index.js';
import { PanoramaEngine } from '../src/panorama/engine.js';
import { SharedPanorama } from '../src/panorama/shared.js';

const stops: (() => void)[] = [];
afterEach(() => {
    for (const s of stops.splice(0)) s();
});

const until = async (check: () => boolean, ms = 4000) => {
    const end = Date.now() + ms;
    while (!check()) {
        if (Date.now() > end) throw new Error('timed out');
        await new Promise((r) => setTimeout(r, 20));
    }
};

describe('shared Panorama over deckbus', () => {
    it('streams the leading plugin\'s slices to the dial next to it', async () => {
        const namespace = `deckbus-test-${crypto.randomBytes(4).toString('hex')}`;
        const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deckbus-key-'));
        const plugin = (id: string, name: string, column: number) => {
            const bus = new DeckBus({ id, name, version: '1.0.0', namespace, keyDir, scanMs: 50, slots: 4, timeoutMs: 300 });
            const actions = new ActionsState(bus, 20);
            const shared = new SharedPanorama(new PanoramaEngine(), actions);
            stops.push(() => {
                shared.dispose();
                bus.stop();
            });
            // trackActions would add the position from the Stream Deck SDK
            actions.set(`${id}-dial`, { device: 'deck', column, row: 0, controller: 'Encoder', action: `${id}.dial` });
            let redraws = 0;
            shared.join(`${id}-dial`, 'deck', column, 'particles', {}, () => redraws++);
            return { bus, shared, redraws: () => redraws };
        };
        const left = plugin('left', 'MA-C', 0);
        const right = plugin('right', 'XR-C', 1);
        expect(await left.bus.start()).toBe(true);
        expect(await right.bus.start()).toBe(true);
        left.shared.connect(left.bus);
        right.shared.connect(right.bus);

        await until(() => right.shared.role('right-dial').role === 'follower');
        expect(left.shared.role('left-dial')).toEqual({ role: 'leader' });
        expect(right.shared.role('right-dial')).toEqual({ role: 'follower', leader: 'MA-C' });
        await until(() => right.shared.renderSlice('right-dial').length > 0 && right.redraws() > 2);
        expect(right.shared.engine.isActive('right-dial')).toBe(false);

        // What the following dial puts into the effect reaches the leader's group
        right.shared.updateLive('right-dial', { color: '#FF0000' });
        const virtual = 'virtual:panorama/deck/1';
        await until(() => left.shared.engine.orchestrator.contextLiveSettings.get(virtual)?.color === '#FF0000');
    }, 10000);
});
