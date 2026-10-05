import { describe, expect, it } from 'vitest';
import { CallReaction, callOf, parseCallChoices } from '../src/players/call-reaction.js';
import type { PlayerEntry } from '../src/players/players.js';
import type { PeerInfo } from '../src/bus/bus.js';

const quiet = { info() {}, warn() {} };
const peer = (call: unknown): PeerInfo => ({ id: 'sac', name: 'SA-C', state: { call } }) as unknown as PeerInfo;
const inCall = [peer({ active: true, app: 'ms-teams', name: 'Microsoft Teams', since: 1 })];
const noCall = [peer({ active: false })];

/** A fake plugin: players whose state follows the commands, and a log of the commands. */
function fakeBoard(players: PlayerEntry[]) {
    const sent: string[] = [];
    return {
        sent,
        players,
        ownPlayers: () => players,
        async command(player: string, command: string, value?: unknown) {
            const p = players.find((x) => x.player === player)!;
            if (p.player === 'broken') throw new Error('offline');
            sent.push(`${player} ${command}${value !== undefined ? ` ${String(value)}` : ''}`);
            if (command === 'pause') p.playing = false;
            if (command === 'play') p.playing = true;
            if (command === 'volume') p.volume = value as number;
            return null;
        },
    };
}
const entry = (player: string, playing: boolean, volume?: number): PlayerEntry => ({ player, name: player, kind: 'speaker', playing, since: 1, volume });

describe('call state and choices', () => {
    it('reads a call from any peer', () => {
        expect(callOf(inCall)).toEqual({ app: 'ms-teams', name: 'Microsoft Teams' });
        expect(callOf(noCall)).toBeUndefined();
        expect(callOf([])).toBeUndefined();
    });

    it('keeps only pause and duck', () => {
        expect(parseCallChoices({ a: 'pause', b: 'duck', c: 'off', d: 3 })).toEqual({ a: 'pause', b: 'duck' });
        expect(parseCallChoices(undefined)).toEqual({});
    });
});

describe('CallReaction', () => {
    it('pauses chosen players that play, and plays them again after the call', async () => {
        const board = fakeBoard([entry('kitchen', true), entry('bath', false), entry('office', true)]);
        const r = new CallReaction(board, quiet);
        r.setChoices({ kitchen: 'pause', bath: 'pause' });
        await r.setPeers(inCall);
        expect(board.sent).toEqual(['kitchen pause']);
        await r.setPeers(noCall);
        expect(board.sent).toEqual(['kitchen pause', 'kitchen play']);
    });

    it("doesn't play a player again that the user started during the call", async () => {
        const board = fakeBoard([entry('kitchen', true)]);
        const r = new CallReaction(board, quiet);
        r.setChoices({ kitchen: 'pause' });
        await r.setPeers(inCall);
        board.players[0].playing = true;
        await r.setPeers(noCall);
        expect(board.sent).toEqual(['kitchen pause']);
    });

    it('lowers to a quarter and puts the volume back, unless the user changed it', async () => {
        const board = fakeBoard([entry('kitchen', true, 40), entry('bath', true, 30)]);
        const r = new CallReaction(board, quiet);
        r.setChoices({ kitchen: 'duck', bath: 'duck' });
        await r.setPeers(inCall);
        expect(board.sent).toEqual(['kitchen volume 10', 'bath volume 8']);
        board.players[1].volume = 20;
        await r.setPeers(noCall);
        expect(board.sent).toEqual(['kitchen volume 10', 'bath volume 8', 'kitchen volume 40']);
    });

    it('does nothing twice for one call, and nothing without a choice', async () => {
        const board = fakeBoard([entry('kitchen', true, 40)]);
        const r = new CallReaction(board, quiet);
        await r.setPeers(inCall);
        r.setChoices({ kitchen: 'pause' });
        await r.setPeers(inCall);
        expect(board.sent).toEqual([]);
    });

    it('lists its players with their choice for the settings', () => {
        const r = new CallReaction(fakeBoard([entry('kitchen', true), entry('bath', false)]), quiet);
        r.setChoices({ bath: 'duck' });
        expect(r.rows()).toEqual([
            { player: 'kitchen', name: 'kitchen' },
            { player: 'bath', name: 'bath', mode: 'duck' },
        ]);
    });

    it('goes on when a player fails', async () => {
        const board = fakeBoard([entry('broken', true), entry('kitchen', true)]);
        const r = new CallReaction(board, quiet);
        r.setChoices({ broken: 'pause', kitchen: 'pause' });
        await r.setPeers(inCall);
        expect(board.sent).toEqual(['kitchen pause']);
    });
});

describe('availability', () => {
    it('shows the section only while some plugin reports calls', async () => {
        let changes = 0;
        const r = new CallReaction(fakeBoard([entry('kitchen', true)]), quiet, () => changes++);
        expect(r.piMessage().available).toBe(false);
        await r.setPeers(noCall);
        expect(r.piMessage()).toEqual({ event: 'kit-call-players', available: true, players: [{ player: 'kitchen', name: 'kitchen' }] });
        await r.setPeers([]);
        expect(r.piMessage().available).toBe(false);
        expect(changes).toBe(2);
    });
});
