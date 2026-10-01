import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusAction } from '../src/bus/actions.js';
import type { PeerInfo } from '../src/bus/bus.js';
import { PanoramaEngine } from '../src/panorama/engine.js';
import { SharedPanorama, sharedGroups, type PanoramaBus } from '../src/panorama/shared.js';

/** An in-memory deckbus: peers see each other's "actions", pub reaches the other side's subscribers. */
class Hub {
    private readonly members = new Map<string, { name: string; actions: BusAction[]; subs: Map<string, Set<(d: unknown, from: PeerInfo) => void>>; peerFns: Set<(p: PeerInfo[]) => void> }>();

    join(id: string, name: string): PanoramaBus & { setActions(list: BusAction[]): void; leave(): void } {
        const me = { name, actions: [] as BusAction[], subs: new Map(), peerFns: new Set<(p: PeerInfo[]) => void>() };
        this.members.set(id, me);
        const info = (mid: string): PeerInfo => ({ id: mid, name: this.members.get(mid)!.name, state: { actions: this.members.get(mid)!.actions } }) as unknown as PeerInfo;
        const others = () => [...this.members.keys()].filter((k) => k !== id).map(info);
        const notifyAll = () => {
            for (const [mid, m] of this.members) for (const fn of m.peerFns) fn([...this.members.keys()].filter((k) => k !== mid).map(info));
        };
        notifyAll();
        return {
            onPeers: (fn) => {
                me.peerFns.add(fn);
                fn(others());
                return () => me.peerFns.delete(fn);
            },
            publish: (topic, data) => {
                for (const [mid, m] of this.members) if (mid !== id) for (const fn of m.subs.get(topic) ?? []) fn(data, info(id));
            },
            subscribe: (topic, fn) => {
                let set = me.subs.get(topic);
                if (!set) me.subs.set(topic, (set = new Set()));
                set.add(fn);
                return () => set!.delete(fn);
            },
            setActions: (list) => {
                me.actions = list;
                notifyAll();
            },
            leave: () => {
                this.members.delete(id);
                notifyAll();
            },
        };
    }
}

const dial = (column: number, effect: string): BusAction => ({ device: 'deck', column, row: 0, controller: 'Encoder', action: 'x.dial', effect });

describe('shared Panorama across plugins', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('groups adjacent dials with the same effect, left to right', () => {
        const s = (owner: string, column: number, effect: string) => ({ owner, ownerName: owner, device: 'deck', column, effect });
        const groups = sharedGroups([s('b', 1, 'particles'), s('a', 0, 'particles'), s('a', 2, 'matrix-rain'), s('c', 3, 'matrix-rain')]);
        expect(groups.map((g) => g.map((x) => `${x.owner}${x.column}`))).toEqual([['a0', 'b1'], ['a2', 'c3']]);
    });

    it('runs locally without partners', () => {
        const p = new SharedPanorama(new PanoramaEngine());
        p.join('k1', 'deck', 0, 'particles', {}, () => {});
        vi.advanceTimersByTime(300);
        expect(p.role('k1')).toEqual({ role: 'local' });
        expect(p.isActive('k1')).toBe(true);
        p.dispose();
    });

    it('lets the leftmost plugin lead and stream the slice to its neighbour', () => {
        const hub = new Hub();
        const busA = hub.join('a', 'MA-C');
        const busB = hub.join('b', 'XR-C');
        const a = new SharedPanorama(new PanoramaEngine());
        const b = new SharedPanorama(new PanoramaEngine());
        const redrawB = vi.fn();
        a.join('a1', 'deck', 0, 'particles', {}, () => {});
        b.join('b1', 'deck', 1, 'particles', {}, redrawB);
        busA.setActions([dial(0, 'particles')]);
        busB.setActions([dial(1, 'particles')]);
        a.connect(busA);
        b.connect(busB);

        expect(a.role('a1')).toEqual({ role: 'leader' });
        expect(b.role('b1')).toEqual({ role: 'follower', leader: 'MA-C' });
        // The follower's own engine runs nothing; the leader's group spans both displays
        expect(b.engine.isActive('b1')).toBe(false);

        vi.advanceTimersByTime(500);
        expect(a.engine.members('a1')).toHaveLength(2);
        expect(redrawB).toHaveBeenCalled();
        expect(b.renderSlice('b1').length).toBeGreaterThan(0);
        a.dispose();
        b.dispose();
    });

    it('keeps different effects apart', () => {
        const hub = new Hub();
        const busA = hub.join('a', 'MA-C');
        const busB = hub.join('b', 'XR-C');
        const a = new SharedPanorama(new PanoramaEngine());
        const b = new SharedPanorama(new PanoramaEngine());
        a.join('a1', 'deck', 0, 'particles', {}, () => {});
        b.join('b1', 'deck', 1, 'matrix-rain', {}, () => {});
        busA.setActions([dial(0, 'particles')]);
        busB.setActions([dial(1, 'matrix-rain')]);
        a.connect(busA);
        b.connect(busB);
        expect(a.role('a1')).toEqual({ role: 'local' });
        expect(b.role('b1')).toEqual({ role: 'local' });
        a.dispose();
        b.dispose();
    });

    it('runs locally again when the leading plugin goes', () => {
        const hub = new Hub();
        const busA = hub.join('a', 'XR-C');
        const busB = hub.join('b', 'HA-C');
        const b = new SharedPanorama(new PanoramaEngine());
        b.join('b1', 'deck', 1, 'particles', {}, () => {});
        busA.setActions([dial(0, 'particles')]);
        busB.setActions([dial(1, 'particles')]);
        b.connect(busB);
        expect(b.role('b1')).toEqual({ role: 'follower', leader: 'XR-C' });
        busA.leave();
        expect(b.role('b1')).toEqual({ role: 'local' });
        vi.advanceTimersByTime(300);
        expect(b.engine.isActive('b1')).toBe(true);
        b.dispose();
    });
});
