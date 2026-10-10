import { afterEach, describe, expect, it, vi } from 'vitest';
import { VolumeDials, type Player, type PlayerEntry, type TransportCommand } from '../src/index.js';

const svgOf = (dataUri: string) => Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64').toString();

function fakeBoard(entry: Partial<PlayerEntry> | undefined) {
    let player: Player | undefined = entry ? ({ player: 'p', name: 'Room', kind: 'speaker', playing: true, since: 0, id: 'device:p', routes: [], via: {} as never, from: {} as never, ...entry } as Player) : undefined;
    const sent: [TransportCommand, unknown][] = [];
    const listeners = new Set<() => void>();
    return {
        sent,
        set(patch: Partial<PlayerEntry>) {
            player = { ...player!, ...patch };
            for (const l of listeners) l();
        },
        board: {
            resolve: () => player,
            send: async (_p: unknown, command: TransportCommand, value?: unknown) => void sent.push([command, value]),
            onChange: (fn: () => void) => {
                listeners.add(fn);
                return () => listeners.delete(fn);
            },
        },
    };
}

const all: VolumeDials[] = [];
afterEach(() => {
    all.splice(0).forEach((d) => d.dispose());
    vi.useRealTimers();
});
function make(entry: Partial<PlayerEntry> | undefined, extra: { defaultStep?: number } = {}) {
    const fake = fakeBoard(entry);
    const images: string[] = [];
    const saved: number[] = [];
    const d = new VolumeDials({
        board: fake.board as never,
        draw: (_id, img) => images.push(svgOf(img)),
        mutedLabel: () => 'Muted',
        noPlayerLabel: () => 'No player',
        savePreset: (_id, v) => saved.push(v),
        ...extra,
    });
    all.push(d);
    return { d, fake, images, saved };
}

describe('VolumeDials', () => {
    it('rotate: shows the target at once, sends only the latest value, a fast spin doubles the step', async () => {
        vi.useFakeTimers();
        const { d, fake, images } = make({ volume: 20, muted: false, can: ['volume', 'mute'] });
        d.show('a', { step: 2 });
        d.rotate('a', 1);
        expect(images.at(-1)).toContain('>22%<');
        expect(fake.sent).toEqual([['volume', 22]]);
        d.rotate('a', 1);
        d.rotate('a', 5);
        expect(images.at(-1)).toContain('>44%<');
        expect(fake.sent).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(150);
        expect(fake.sent.at(-1)).toEqual(['volume', 44]);
    });

    it('turning a muted player unmutes it; a player with only steps gets volume-by', async () => {
        const a = make({ volume: 20, muted: true, can: ['volume', 'mute'] });
        a.d.show('a', {});
        a.d.rotate('a', 1);
        await Promise.resolve();
        expect(a.fake.sent).toEqual([['mute', false], ['volume', 21]]);
        const b = make({ volume: 50, can: ['volume-by'] });
        b.d.show('a', {});
        b.d.rotate('a', -3);
        expect(b.fake.sent).toEqual([['volume-by', -3]]);
    });

    it('push mutes explicitly; the dial shows it at once', async () => {
        const { d, fake, images } = make({ volume: 40, muted: false });
        d.show('a', {});
        await d.mute('a');
        expect(fake.sent).toEqual([['mute', true]]);
        expect(images.at(-1)).toContain('Muted');
    });

    it('a tap recalls the preset (unmuting), a long tap saves the current volume', async () => {
        const { d, fake, saved } = make({ volume: 40, muted: true });
        d.show('a', { preset: 15 });
        await d.recall('a');
        expect(fake.sent).toEqual([['mute', false], ['volume', 15]]);
        fake.set({ volume: 33, muted: false });
        d.show('a', { preset: 15 });
        d.savePreset('a');
        expect(saved).toEqual([15]);
    });

    it('no player: a dimmed dial, no commands', () => {
        const { d, fake, images } = make(undefined);
        d.show('a', {});
        d.rotate('a', 1);
        expect(fake.sent).toEqual([]);
        expect(images.at(-1)).toContain('No player');
    });
});
