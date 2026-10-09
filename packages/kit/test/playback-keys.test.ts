import { afterEach, describe, expect, it } from 'vitest';
import { mdiAllInclusive, mdiRepeatOnce, mdiShuffleDisabled, mdiShuffleVariant, mdiSkipNext } from '@mdi/js';
import { PlaybackKeys, parseTransport, type Player, type PlayerEntry, type TransportCommand } from '../src/index.js';

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

const all: PlaybackKeys[] = [];
afterEach(() => all.splice(0).forEach((k) => k.dispose()));
function make(entry: Partial<PlayerEntry> | undefined, accent?: string) {
    const fake = fakeBoard(entry);
    const images: string[] = [];
    const now = { t: 1000 };
    const k = new PlaybackKeys({ board: fake.board as never, draw: (_id, img) => images.push(svgOf(img)), accent, now: () => now.t });
    all.push(k);
    return { k, fake, images, now };
}

describe('PlaybackKeys', () => {
    it("next sends next; a player that can't skip (radio) shows the key unavailable and refuses", async () => {
        const { k, fake, images } = make({ can: ['next', 'previous'] });
        k.show('a', { command: 'next' });
        expect(images.at(-1)).toContain(mdiSkipNext);
        await k.press('a');
        expect(fake.sent).toEqual([['next', undefined]]);
        fake.set({ can: ['play-pause'] });
        expect(images.at(-1)).toContain('#4a4a50');
        await expect(k.press('a')).rejects.toThrow();
    });

    it('shuffle flips at once (plate and frame), sends the new value, the player confirms', async () => {
        const { k, fake, images } = make({ shuffle: false }, '#3a8dde');
        k.show('a', { command: 'shuffle' });
        expect(images.at(-1)).toContain(mdiShuffleDisabled);
        await k.press('a');
        expect(fake.sent).toEqual([['shuffle', true]]);
        expect(images.at(-1)).toContain(mdiShuffleVariant);
        expect(images.at(-1)).toContain('stroke="#3a8dde"');
        fake.set({ shuffle: true });
        expect(images.at(-1)).toContain(mdiShuffleVariant);
    });

    it('repeat goes off → all → one → off', async () => {
        const { k, fake, images } = make({ repeat: 'all' });
        k.show('a', { command: 'repeat' });
        await k.press('a');
        expect(fake.sent.at(-1)).toEqual(['repeat', 'one']);
        expect(images.at(-1)).toContain(mdiRepeatOnce);
    });

    it("Don't stop the music sends autoplay, only where the player has it", async () => {
        const { k, fake, images } = make({ autoplay: false, can: ['autoplay', 'crossfade'] });
        k.show('a', { command: 'dont_stop' });
        expect(images.at(-1)).toContain(mdiAllInclusive);
        await k.press('a');
        expect(fake.sent).toEqual([['autoplay', true]]);
        const sonos = make({ can: ['next', 'shuffle'] });
        sonos.k.show('b', { command: 'crossfade' });
        expect(sonos.images.at(-1)).toContain('#4a4a50');
        expect(() => parseTransport({ player: 'p', command: 'crossfade' })).toThrow();
    });

    it('seek mode: taps add up to one seek; the key shows the jump', async () => {
        const { k, fake, images } = make({ position: 30, duration: 200, at: 1000, playing: false });
        k.show('a', { command: 'next', seekStep: '15' });
        expect(k.toggleSeek('a')).toBe(true);
        await k.press('a');
        await k.press('a');
        expect(images.at(-1)).toContain('+0:30');
        await new Promise((r) => setTimeout(r, 500));
        expect(fake.sent).toEqual([['seek', 60]]);
        k.toggleSeek('a');
        expect(k.seeking('a')).toBe(false);
    });
});
