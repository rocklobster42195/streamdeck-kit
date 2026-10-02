import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeerInfo } from '../src/bus/bus.js';
import { PanoramaEngine } from '../src/panorama/engine.js';
import { PanoramaRows, rowStateFromSettings, type PanoramaRow, type RowsBus } from '../src/panorama/rows.js';
import { SharedPanorama } from '../src/panorama/shared.js';

type Settings = Record<string, unknown>;

function setup() {
    const panorama = new SharedPanorama(new PanoramaEngine());
    const rows = new PanoramaRows(panorama, { name: 'HA-C' });
    const settings = new Map<string, Settings>();
    const add = (ctx: string, column: number, s: Settings = {}) => {
        settings.set(ctx, s);
        rows.add(ctx, {
            device: 'deck',
            column,
            label: () => ctx,
            state: () => rowStateFromSettings(settings.get(ctx)!),
            save: (patch) => settings.set(ctx, { ...settings.get(ctx), ...patch }),
            redraw: () => {},
        });
    };
    return { panorama, rows, settings, add };
}

const peer = (name: string, rows: Record<string, PanoramaRow>, actions: unknown[] = []): PeerInfo =>
    ({ id: `id.${name}`, name, version: '1', caps: [], slot: 0, protocol: 1, state: { 'panorama-rows': rows, actions } }) as unknown as PeerInfo;

function fakeBus() {
    let peersFn: (p: PeerInfo[]) => void = () => {};
    const state = new Map<string, unknown>();
    const requests: unknown[] = [];
    const bus: RowsBus = {
        onPeers: (fn) => {
            peersFn = fn as (p: PeerInfo[]) => void;
            fn([]);
            return () => {};
        },
        setState: (k, v) => void state.set(k, v),
        handle: () => {},
        request: (_peer, method, params) => {
            requests.push({ method, params });
            return Promise.resolve(true);
        },
    };
    return { bus, state, requests, peers: (p: PeerInfo[]) => peersFn(p) };
}

describe('Panorama per row', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('starts with Particles and stores the row with every dial', () => {
        const { rows, settings, add } = setup();
        add('a', 0);
        add('b', 1);
        expect(rows.rowOf('deck').effect).toBe('particles');
        expect((settings.get('b')!.panorama as PanoramaRow).effect).toBe('particles');
        expect(rows.isMember('a')).toBe(true);
    });

    it('takes over old settings: an effect, "none" unchecks, the left one wins', () => {
        const { rows, add } = setup();
        add('a', 0, { background: 'matrix-rain', savedDensity: 0.4 });
        add('b', 1, { background: 'boing-ball' });
        add('c', 2, { background: 'none' });
        expect(rows.rowOf('deck')).toMatchObject({ effect: 'matrix-rain', settings: { savedDensity: 0.4 } });
        expect(rows.isMember('c')).toBe(false);
    });

    it('a choice sets the effect for the row; the latest change wins across plugins', () => {
        const { rows, settings, add } = setup();
        const b = fakeBus();
        rows.connect(b.bus);
        add('a', 0);
        rows.setRow('deck', { effect: 'boing-ball' });
        expect((settings.get('a')!.panorama as PanoramaRow).effect).toBe('boing-ball');
        expect((b.state.get('panorama-rows') as Record<string, PanoramaRow>).deck.effect).toBe('boing-ball');
        // Another plugin chose later
        b.peers([peer('MA-C', { deck: { effect: 'matrix-rain', settings: {}, stamp: Date.now() + 1000 } })]);
        expect(rows.rowOf('deck').effect).toBe('matrix-rain');
        expect((settings.get('a')!.panorama as PanoramaRow).effect).toBe('matrix-rain');
        // An older one doesn't
        b.peers([peer('XR-C', { deck: { effect: 'boing-globe', settings: {}, stamp: 5 } })]);
        expect(rows.rowOf('deck').effect).toBe('matrix-rain');
    });

    it('keeps tuning for the same effect and starts fresh for a new one', () => {
        const { rows, add } = setup();
        add('a', 0);
        rows.setRow('deck', { settings: { savedSpeed: 3 } });
        rows.setRow('deck', { settings: { savedDensity: 0.5 } });
        expect(rows.rowOf('deck').settings).toEqual({ savedSpeed: 3, savedDensity: 0.5 });
        rows.setRow('deck', { effect: 'boing-ball' });
        expect(rows.rowOf('deck').settings).toEqual({});
    });

    it('checks other plugins\' dials through the bus', async () => {
        const { rows, add } = setup();
        const b = fakeBus();
        rows.connect(b.bus);
        add('a', 0);
        b.peers([peer('XR-C', {}, [{ device: 'deck', column: 1, row: 0, controller: 'Encoder', action: 'x', label: 'Vocals' }])]);
        expect(rows.info('a').dials.map((d) => `${d.plugin}:${d.label}:${d.member}`)).toEqual(['HA-C:a:true', 'XR-C:Vocals:true']);
        await rows.setMember('deck', 1, false);
        expect(b.requests).toEqual([{ method: 'panorama-member', params: { device: 'deck', column: 1, member: false } }]);
        await rows.setMember('deck', 0, false);
        expect(rows.isMember('a')).toBe(false);
    });

    it('"none" for the row leaves the Panorama', () => {
        const { rows, panorama, add } = setup();
        add('a', 0);
        vi.advanceTimersByTime(100);
        expect(panorama.engine.isActive('a')).toBe(true);
        rows.setRow('deck', { effect: 'none' });
        vi.advanceTimersByTime(100);
        expect(rows.effectOf('a')).toBeUndefined();
        expect(panorama.engine.isActive('a')).toBe(false);
    });
});
