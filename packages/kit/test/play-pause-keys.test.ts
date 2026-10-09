import { afterEach, describe, expect, it } from 'vitest';
import { mdiBatteryAlert, mdiSofa } from '@mdi/js';
import { PlayPauseKeys, serviceIcon, batteryBadge, cornerSvg, renderPlayPauseKey, readableBar, type Player, type PlayerEntry, type TransportCommand } from '../src/index.js';

const svgOf = (dataUri: string) => Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64').toString();

/** A board with one player whose state the test sets. */
function fakeBoard(entry: Partial<PlayerEntry> | undefined) {
    let player: Player | undefined = entry ? ({ player: 'p', name: 'Room', kind: 'speaker', playing: false, since: 0, id: 'device:p', routes: [], via: {} as never, from: {} as never, ...entry } as Player) : undefined;
    const sent: TransportCommand[] = [];
    const listeners = new Set<() => void>();
    let fail = false;
    return {
        sent,
        failNext: () => (fail = true),
        set(patch: Partial<PlayerEntry>) {
            player = { ...player!, ...patch };
            for (const l of listeners) l();
        },
        board: {
            resolve: (choice?: string) => (choice === 'active' || choice === 'device:p' ? player : undefined),
            send: async (_p: unknown, command: TransportCommand) => {
                if (fail) {
                    fail = false;
                    throw new Error('refused');
                }
                sent.push(command);
            },
            onChange: (fn: () => void) => {
                listeners.add(fn);
                return () => listeners.delete(fn);
            },
        },
    };
}

const keys: PlayPauseKeys[] = [];
afterEach(() => keys.splice(0).forEach((k) => k.dispose()));
function make(entry: Partial<PlayerEntry> | undefined, now = { t: 1000 }) {
    const fake = fakeBoard(entry);
    const images: string[] = [];
    const k = new PlayPauseKeys({ board: fake.board as never, draw: (_id, img) => images.push(svgOf(img)), markerPath: (n) => (n === 'sofa' ? mdiSofa : undefined), now: () => now.t });
    keys.push(k);
    return { k, fake, images, now };
}

describe('PlayPauseKeys', () => {
    it('sends an explicit pause or play by what the key shows, and shows it at once', async () => {
        const { k, fake } = make({ playing: true, can: ['play', 'pause', 'play-pause'] });
        k.show('a', {});
        await k.press('a');
        expect(fake.sent).toEqual(['pause']);
        // The device hasn't confirmed yet (a server that learns of it late): the key still shows paused
        expect(k.playing('a')).toBe(false);
        // A second press plays, not pauses again
        await k.press('a');
        expect(fake.sent).toEqual(['pause', 'play']);
        expect(k.playing('a')).toBe(true);
    });

    it("lets the device's state win once it agrees or the hold ran out", async () => {
        const { k, fake, now } = make({ playing: false });
        k.show('a', {});
        await k.press('a');
        expect(k.playing('a')).toBe(true);
        // The device never starts: after 8 s the key believes it again
        now.t += 8001;
        expect(k.playing('a')).toBe(false);
        fake.set({ playing: true });
        expect(k.playing('a')).toBe(true);
    });

    it('uses the toggle for a peer that only knows it; a refused command undoes the shown state', async () => {
        const { k, fake } = make({ playing: true, can: ['play-pause'] });
        k.show('a', {});
        await k.press('a');
        expect(fake.sent).toEqual(['play-pause']);
        const other = make({ playing: true });
        other.k.show('b', {});
        other.fake.failNext();
        await expect(other.k.press('b')).rejects.toThrow('refused');
        expect(other.k.playing('b')).toBe(true);
    });

    it('without a player: a dimmed key, and a press rejects', async () => {
        const { k, images } = make(undefined);
        k.show('a', { marker: 'sofa' });
        expect(images.at(-1)).toContain('#4a4a50');
        await expect(k.press('a')).rejects.toThrow('no player');
    });

    it('freezes the progress while paused and draws only what changed', async () => {
        const { k, images, now } = make({ playing: true, position: 10, duration: 100, at: 1000, cover: 'data:image/png;base64,AA', can: ['play', 'pause'] });
        k.show('a', { showProgress: true });
        const drawn = images.length;
        k.show('a', { showProgress: true });
        expect(images.length).toBe(drawn + 1); // a settings change redraws once
        await k.press('a');
        const paused = images.at(-1)!;
        now.t += 30_000;
        // Still the frozen picture (the device keeps saying "playing")
        expect(paused).toContain('opacity="0.55"');
        const widthOf = (svg: string) => Number(/<rect x="6" y="134" width="(\d+)"[^>]*fill="(?!#ffffff)/.exec(svg)?.[1] ?? 0);
        expect(widthOf(paused)).toBeGreaterThan(0);
    });

    it("shows the player's name as the title when asked", () => {
        const titles: string[] = [];
        const fake = fakeBoard({ playing: true, name: 'Küche + 2' });
        const k = new PlayPauseKeys({ board: fake.board as never, draw: (_id, _img, title) => titles.push(title) });
        keys.push(k);
        k.show('a', { showName: true });
        expect(titles.at(-1)).toBe('Küche + 2');
        k.show('a', {});
        expect(titles.at(-1)).toBe('');
    });

    it('fills the corners the user picked', () => {
        const { k, images } = make({ playing: true, source: 'Spotify', battery: 15 });
        k.show('a', { topLeft: 'marker', topRight: 'battery', marker: 'sofa' });
        const svg = images.at(-1)!;
        expect(svg).toContain(mdiSofa);
        expect(svg).toContain(mdiBatteryAlert);
        k.show('a', { topLeft: 'none', topRight: 'source' });
        expect(images.at(-1)).not.toContain(mdiSofa);
        expect(images.at(-1)).toContain('<circle cx="120" cy="24"');
    });
});

describe('service logos by name', () => {
    it('finds a service however a plugin spells it; radio, own files and unknown ones get a symbol', () => {
        const spotify = serviceIcon('Spotify');
        expect(spotify.logo).toBe(true);
        expect(serviceIcon('apple_music').logo).toBe(true);
        expect(serviceIcon('Apple Music').path).toBe(serviceIcon('applemusic').path);
        expect(serviceIcon('TIDAL').logo).toBe(true);
        expect(serviceIcon('Ytmusic').path).toBe(serviceIcon('YouTube Music').path);
        expect(serviceIcon('Sonos Radio').logo).toBe(true);
        expect(serviceIcon('TuneIn').logo).toBe(false);
        expect(serviceIcon('Radiobrowser').path).toBe(serviceIcon('TuneIn').path);
        expect(serviceIcon('Filesystem smb').path).not.toBe(serviceIcon('Something new').path);
    });
});

describe('corners and picture', () => {
    it('battery: only when low in "low" mode, the level in "always"', () => {
        expect(batteryBadge(60, false, 'low')).toBeUndefined();
        expect(batteryBadge(15, false, 'low')).toMatchObject({ kind: 'icon', path: mdiBatteryAlert });
        expect(batteryBadge(15, true, 'low')).toBeUndefined();
        expect(batteryBadge(60, false, 'always')).toMatchObject({ color: '#4DDB6E' });
        expect(batteryBadge(undefined, false, 'always')).toBeUndefined();
    });

    it('an SVG picture goes in as a group (Stream Deck draws no nested SVG), fitted into the corner', () => {
        const logo = `data:image/svg+xml;base64,${Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" fill="#fff"><path d="M0 0h48v24H0z"/></svg>').toString('base64')}`;
        const svg = cornerSvg({ kind: 'image', href: logo }, 'left');
        expect(svg).toContain('<g transform=');
        // In the corners' one colour, like the marker next to it
        expect(svg).toContain('fill="#e0e0e0"');
        expect(svg).not.toContain('fill="#fff"');
        expect(svg).not.toContain('<image');
        expect(svg).not.toContain('<svg');
    });

    it('a picture corner is clipped to a circle on the left or right', () => {
        expect(cornerSvg({ kind: 'image', href: 'data:image/png;base64,AA' }, 'right')).toContain('cx="120"');
        expect(cornerSvg(undefined, 'left')).toBe('');
    });

    it('paused: the cover dimmed with a play symbol; playing: just the cover', () => {
        const base = { cover: 'data:image/png;base64,AA', iconColor: '#ccc', accent: '#f00' };
        expect(svgOf(renderPlayPauseKey({ ...base, playing: false }))).toContain('opacity="0.55"');
        expect(svgOf(renderPlayPauseKey({ ...base, playing: true }))).not.toContain('opacity="0.55"');
    });

    it('brightens a dark bar colour, keeps a light one', () => {
        expect(readableBar('#ffffff')).toBe('#ffffff');
        expect(readableBar('#202020')).toMatch(/^rgb\(/);
    });
});
