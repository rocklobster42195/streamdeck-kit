// Players on deckbus: merging by device, the active player, choices, routing (fake peers), seek
// mode (fake timers), key colours, and one transport round trip over real pipes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeckBus, type PeerInfo } from '../src/bus/index.js';
import { CoverBoard } from '../src/panorama/covers.js';
import { KEY_GREY, PlayerBoard, SeekStepper, parseTransport, playerOptions, positionNow, resolveKeyColor, type PlayerEntry, type Transport } from '../src/players/index.js';

const peer = (name: string, players: PlayerEntry[], slot = 1): PeerInfo => ({ id: `id.${name}`, name, version: '1', caps: [], slot, protocol: 1, state: { players } }) as unknown as PeerInfo;
const speaker = (player: string, o: Partial<PlayerEntry> = {}): PlayerEntry => ({ player, name: player, kind: 'speaker', playing: false, since: 0, ...o });

afterEach(() => vi.useRealTimers());

describe('parseTransport', () => {
    it('takes valid commands and refuses bad ones', () => {
        expect(parseTransport({ player: 'p', command: 'next' })).toEqual({ player: 'p', command: 'next' });
        expect(parseTransport({ player: 'p', command: 'seek', value: 12.5 })).toEqual({ player: 'p', command: 'seek', value: 12.5 });
        expect(() => parseTransport({ command: 'next' })).toThrow(/player/);
        expect(() => parseTransport({ player: 'p', command: 'explode' })).toThrow(/unknown command/);
        expect(() => parseTransport({ player: 'p', command: 'seek' })).toThrow(/number/);
        expect(() => parseTransport({ player: 'p', command: 'mute', value: 'yes' })).toThrow(/true or false/);
        expect(() => parseTransport({ player: 'p', command: 'repeat', value: 'twice' })).toThrow(/repeat/);
    });
});

describe('positionNow', () => {
    it('counts on while playing, up to the duration', () => {
        expect(positionNow({ position: 10, at: 1000, playing: true, duration: 100 }, 6000)).toBe(15);
        expect(positionNow({ position: 10, at: 1000, playing: false }, 6000)).toBe(10);
        expect(positionNow({ position: 98, at: 0, playing: true, duration: 100 }, 10_000)).toBe(100);
        expect(positionNow({ playing: true })).toBeUndefined();
    });
});

describe('PlayerBoard', () => {
    it('one device seen by two plugins is one player: commands direct, media from whoever plays it', () => {
        const board = new PlayerBoard('SO-C');
        board.publish([speaker('RINCON_1', { device: 'RINCON_1', name: 'Bad', direct: true, playing: true, since: 5, title: 'Sonos title', volume: 12, can: ['play-pause', 'seek'] })]);
        board.setPeers([peer('MA-C', [speaker('ma-bad', { device: 'RINCON_1', name: 'Badezimmer (MA)', media: true, playing: true, since: 7, title: 'MA title', color: '#ff0000', volume: 99 })])]);
        const [bad, ...rest] = board.players();
        expect(rest).toEqual([]);
        expect(bad.id).toBe('device:RINCON_1');
        expect(bad.name).toBe('Bad');
        expect(bad.via.source).toBe('SO-C');
        expect(bad.from.source).toBe('MA-C');
        expect(bad.title).toBe('MA title');
        expect(bad.color).toBe('#ff0000');
        expect(bad.volume).toBe(12);
        expect(bad.can).toEqual(['play-pause', 'seek']);
        expect(bad.since).toBe(7);
    });

    it('without a direct plugin, commands go to the one that knows it', () => {
        const board = new PlayerBoard('SA-C');
        board.setPeers([peer('MA-C', [speaker('ma-bad', { device: 'RINCON_1', name: 'Bad' })])]);
        expect(board.resolve('device:RINCON_1')?.via.source).toBe('MA-C');
    });

    it('active = the speaker that started last; apps only with active:all', () => {
        const board = new PlayerBoard('SO-C');
        board.publish([speaker('kitchen', { playing: true, since: 10 }), speaker('bath', { playing: false, since: 30 })]);
        board.setPeers([peer('SA-C', [{ player: 's1', name: 'Spotify', kind: 'app', app: 'Spotify', playing: true, since: 20 }])]);
        expect(board.resolve('active')?.player).toBe('kitchen');
        expect(board.resolve(undefined)?.player).toBe('kitchen');
        expect(board.resolve('active:all')?.player).toBe('s1');
        expect(board.resolve('app:Spotify')?.name).toBe('Spotify');
        expect(board.resolve('SO-C/bath')?.player).toBe('bath');
        expect(board.resolve('device:gone')).toBeUndefined();
    });

    it('two sessions of one app are one player: the one that plays', () => {
        const board = new PlayerBoard('SO-C');
        const app = (player: string, playing: boolean, since: number): PlayerEntry => ({ player, name: 'Chrome', kind: 'app', app: 'Chrome', playing, since });
        board.setPeers([peer('SA-C', [app('tab1', false, 50), app('tab2', true, 10)])]);
        expect(board.players().map((p) => p.player)).toEqual(['tab2']);
    });

    it('sends to its own players directly and to others over the bus', async () => {
        const got: Transport[] = [];
        const requests: unknown[][] = [];
        const board = new PlayerBoard('SO-C');
        board.serve((t) => void got.push(t));
        const bus = {
            onPeers: () => () => {},
            setState: () => {},
            handle: () => {},
            request: async (...args: unknown[]) => void requests.push(args),
        };
        board.connect(bus as never);
        board.publish([speaker('bath')]);
        board.setPeers([peer('MA-C', [speaker('shield', { name: 'SHIELD' })])]);
        await board.send('SO-C/bath', 'next');
        await board.send('MA-C/shield', 'volume', 20);
        expect(got).toEqual([{ player: 'bath', command: 'next' }]);
        expect(requests).toHaveLength(1);
        expect(requests[0][1]).toBe('transport');
        expect(requests[0][2]).toEqual({ player: 'shield', command: 'volume', value: 20 });
        await expect(board.send('device:gone', 'next')).rejects.toThrow(/no such player/);
    });

    it('the dropdown: active entries first, then every player with the plugins that know it', () => {
        const board = new PlayerBoard('SO-C');
        board.publish([speaker('RINCON_1', { device: 'RINCON_1', name: 'Bad', direct: true, playing: true, since: 1 })]);
        board.setPeers([peer('MA-C', [speaker('ma-bad', { device: 'RINCON_1', name: 'Bad' })]), peer('SA-C', [{ player: 's', name: 'Spotify', kind: 'app', app: 'Spotify', playing: false, since: 0 }])]);
        expect(playerOptions(board.players())).toEqual([
            { value: 'active', label: 'kit.player_active' },
            { value: 'active:all', label: 'kit.player_active_all' },
            { value: 'device:RINCON_1', label: '▶ Bad', sub: 'SO-C · MA-C' },
            { value: 'app:Spotify', label: 'Spotify', sub: 'SA-C' },
        ]);
        expect(playerOptions(board.players(), { kind: 'speaker' }).map((o) => o.value)).toEqual(['active', 'device:RINCON_1']);
    });

    it('tells listeners only about real changes', () => {
        const board = new PlayerBoard('SO-C');
        let calls = 0;
        board.onChange(() => calls++);
        board.setPeers([peer('MA-C', [speaker('a')])]);
        board.setPeers([peer('MA-C', [speaker('a')])]);
        expect(calls).toBe(1);
    });

    it('a CoverBoard reads colours from a peer’s players', () => {
        const covers = new CoverBoard('SA-C');
        covers.setPeers([peer('SO-C', [speaker('bath', { color: '#00ff00', playing: true, since: 1 })])]);
        expect(covers.resolve('cover')).toBe('#00ff00');
    });
});

describe('SeekStepper', () => {
    const make = (o: { position?: number; duration?: number } = {}) => {
        const seeks: number[] = [];
        const s = new SeekStepper({ position: () => o.position ?? 30, duration: () => ('duration' in o ? o.duration : 200), seek: (t) => seeks.push(t) });
        return { s, seeks };
    };

    it('quick taps add up to one seek', () => {
        vi.useFakeTimers();
        const { s, seeks } = make();
        expect(s.enter()).toBe(true);
        for (let i = 0; i < 6; i++) {
            s.tap(10);
            vi.advanceTimersByTime(150);
        }
        expect(s.offset).toBe(60);
        expect(s.target).toBe(90);
        expect(seeks).toEqual([]);
        vi.advanceTimersByTime(400);
        expect(seeks).toEqual([90]);
        expect(s.offset).toBe(0);
        expect(s.active).toBe(true);
    });

    it('ends by itself after the idle time; a long press ends it at once and sends waiting taps', () => {
        vi.useFakeTimers();
        const { s, seeks } = make();
        s.enter();
        vi.advanceTimersByTime(3000);
        expect(s.active).toBe(false);
        s.enter();
        s.tap(-10);
        s.exit();
        expect(seeks).toEqual([20]);
        expect(s.active).toBe(false);
    });

    it('stops one second before the end and at 0; no seek mode without a duration', () => {
        vi.useFakeTimers();
        const end = make({ position: 190, duration: 200 });
        end.s.enter();
        end.s.tap(30);
        expect(end.s.target).toBe(199);
        const start = make({ position: 5 });
        start.s.enter();
        start.s.tap(-30);
        expect(start.s.target).toBe(0);
        expect(make({ duration: undefined }).s.enter()).toBe(false);
    });
});

describe('resolveKeyColor', () => {
    it('grey, cover, row or fixed', () => {
        expect(resolveKeyColor(undefined)).toBe(KEY_GREY);
        expect(resolveKeyColor('grey', { cover: '#ff0000' })).toBe(KEY_GREY);
        expect(resolveKeyColor('cover', { cover: '#ff0000' })).toBe('#ff0000');
        expect(resolveKeyColor('cover', {})).toBe(KEY_GREY);
        expect(resolveKeyColor('row', { row: '#00ff00' })).toBe('#00ff00');
        expect(resolveKeyColor('#123abc')).toBe('#123abc');
    });
});

describe('transport over real pipes', () => {
    const buses: DeckBus[] = [];
    afterEach(() => {
        for (const b of buses.splice(0)) b.stop();
    });

    it('a key in one plugin controls a player of another; the owner can say no', async () => {
        const namespace = `deckbus-test-${crypto.randomBytes(4).toString('hex')}`;
        const keyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deckbus-key-'));
        const make = (id: string) => {
            const b = new DeckBus({ id, name: id, version: '1', namespace, keyDir, scanMs: 50, slots: 4, timeoutMs: 500 });
            buses.push(b);
            return b;
        };
        const soBus = make('SO-C');
        const maBus = make('MA-C');
        const so = new PlayerBoard('SO-C');
        const ma = new PlayerBoard('MA-C');
        let allowOthers = true;
        const got: Transport[] = [];
        ma.serve((t) => {
            got.push(t);
            return { done: true };
        });
        ma.connect(maBus, { allow: () => allowOthers });
        so.connect(soBus);
        ma.publish([speaker('shield', { name: 'SHIELD', can: ['play-pause'] })]);
        await soBus.start();
        await maBus.start();
        const until = async (check: () => boolean) => {
            const end = Date.now() + 3000;
            while (!check()) {
                if (Date.now() > end) throw new Error('timed out');
                await new Promise((r) => setTimeout(r, 10));
            }
        };
        await until(() => !!so.resolve('MA-C/shield'));

        await expect(so.send('MA-C/shield', 'play-pause')).resolves.toEqual({ done: true });
        expect(got).toEqual([{ player: 'shield', command: 'play-pause' }]);
        await expect(soBus.request('MA-C', 'transport', { player: 'nobody', command: 'next' })).rejects.toThrow(/unknown player/);
        allowOthers = false;
        await expect(so.send('MA-C/shield', 'next')).rejects.toThrow('not allowed');
    });
});
