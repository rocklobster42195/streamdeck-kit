import { afterEach, describe, expect, it } from 'vitest';
import { mdiVolumeOff } from '@mdi/js';
import { VolumeKeys, renderVolumeKey, type Player, type PlayerEntry, type TransportCommand } from '../src/index.js';

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

const all: VolumeKeys[] = [];
afterEach(() => all.splice(0).forEach((k) => k.dispose()));
function make(entry: Partial<PlayerEntry> | undefined) {
    const fake = fakeBoard(entry);
    const images: string[] = [];
    const k = new VolumeKeys({ board: fake.board as never, draw: (_id, img) => images.push(svgOf(img)), accent: '#6cc4ff' });
    all.push(k);
    return { k, fake, images };
}

describe('VolumeKeys', () => {
    it('louder: from the volume the key shows, also on quick presses before the player confirms', async () => {
        const { k, fake, images } = make({ volume: 20, muted: false, can: ['volume', 'mute'] });
        k.show('a', { command: 'up', step: '5' });
        expect(images.at(-1)).toContain('>20<');
        await k.press('a');
        await k.press('a');
        expect(fake.sent).toEqual([['volume', 25], ['volume', 30]]);
        expect(images.at(-1)).toContain('>30<');
    });

    it('a player with only relative volume gets volume-by', async () => {
        const { k, fake } = make({ volume: 50, can: ['volume-by'] });
        k.show('a', { command: 'down' });
        await k.press('a');
        expect(fake.sent).toEqual([['volume-by', -5]]);
    });

    it('mute flips at once (grey gauge, red speaker); a preset unmutes and sets the volume', async () => {
        const { k, fake, images } = make({ volume: 40, muted: false });
        k.show('a', { command: 'mute' });
        await k.press('a');
        expect(fake.sent).toEqual([['mute', true]]);
        expect(images.at(-1)).toContain(mdiVolumeOff);
        const preset = make({ volume: 40, muted: true });
        preset.k.show('b', { command: 'preset', preset: '25' });
        await preset.k.press('b');
        expect(preset.fake.sent).toEqual([['mute', false], ['volume', 25]]);
    });

    it('a preset on another command: a long press sets it (unmuted); none: no long press', async () => {
        const { k, fake } = make({ volume: 40, muted: true });
        k.show('a', { command: 'mute', preset: 18 });
        expect(k.hasLongPress('a')).toBe(true);
        await k.pressPreset('a');
        expect(fake.sent).toEqual([['mute', false], ['volume', 18]]);
        k.show('a', { command: 'mute' });
        expect(k.hasLongPress('a')).toBe(false);
        k.show('a', { command: 'preset', preset: 18 });
        expect(k.hasLongPress('a')).toBe(false);
    });

    it('without a player or a volume: dimmed, and a press rejects', async () => {
        const { k, images } = make(undefined);
        k.show('a', { command: 'up' });
        expect(images.at(-1)).toContain('#4a4a50');
        await expect(k.press('a')).rejects.toThrow();
    });

    it('the mute key as ring, pie or open ring', () => {
        const base = { command: 'mute' as const, volume: 60, muted: false, preset: 20, showVolume: true, color: '#6cc4ff' };
        expect(svgOf(renderVolumeKey({ ...base, gauge: 'ring' }))).toContain('stroke-dasharray');
        expect(svgOf(renderVolumeKey({ ...base, gauge: 'pie' }))).not.toContain('>60<');
        expect(svgOf(renderVolumeKey({ ...base, gauge: 'open' }))).toContain('>60<');
    });
});
