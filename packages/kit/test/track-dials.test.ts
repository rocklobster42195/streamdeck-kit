import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackDials, type Player, type PlayerEntry, type TransportCommand } from '../src/index.js';

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

const all: TrackDials[] = [];
afterEach(() => {
    all.splice(0).forEach((d) => d.dispose());
    vi.useRealTimers();
});
function make(entry: Partial<PlayerEntry> | undefined) {
    const fake = fakeBoard(entry);
    const images: string[] = [];
    const d = new TrackDials({ board: fake.board as never, draw: (_id, img) => images.push(svgOf(img)), nothingLabel: () => 'Nothing playing', now: () => 10_000 });
    all.push(d);
    return { d, fake, images };
}

describe('TrackDials', () => {
    it('shows title, artist and progress of the player', () => {
        const { d, images } = make({ title: 'Invented Song', artist: 'Sim Artist', position: 30, at: 10_000, duration: 120, playing: true });
        d.show('a', {});
        expect(images.at(-1)).toContain('Invented Song');
        expect(images.at(-1)).toContain('Sim Artist');
        expect(images.at(-1)).toContain('width="21.0"');
    });

    it('rotate seeks by seconds per tick (default 10, a set step), shown at once, only the latest is sent', async () => {
        vi.useFakeTimers();
        const { d, fake } = make({ title: 'T', position: 30, at: 10_000, duration: 120, playing: false, can: ['seek', 'next'] });
        d.show('a', { seekStep: 5 });
        d.rotate('a', 2);
        d.rotate('a', 1);
        await vi.advanceTimersByTimeAsync(250);
        expect(fake.sent.at(-1)).toEqual(['seek', 45]);
    });

    it('no seeking on a live stream; push skips; a tap pauses or plays explicitly', async () => {
        const live = make({ title: 'Radio', playing: true });
        live.d.show('a', {});
        live.d.rotate('a', 3);
        expect(live.fake.sent).toEqual([]);
        expect(live.images.at(-1)).toContain('LIVE');
        const playing = make({ title: 'T', duration: 100, position: 5, at: 10_000, playing: true });
        playing.d.show('a', {});
        await playing.d.next('a');
        await playing.d.playPause('a');
        expect(playing.fake.sent).toEqual([['next', undefined], ['pause', undefined]]);
        const paused = make({ title: 'T', duration: 100, position: 5, playing: false });
        paused.d.show('a', {});
        await paused.d.playPause('a');
        expect(paused.fake.sent).toEqual([['play', undefined]]);
    });

    it('no player: the nothing-playing text', () => {
        const { d, images } = make(undefined);
        d.show('a', {});
        expect(images.at(-1)).toContain('Nothing');
        expect(images.at(-1)).toContain('playing');
    });
});
