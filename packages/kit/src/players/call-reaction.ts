// "When a call starts on the computer" (SA-C grill 2026-10-05, Q3): a music plugin pauses or lowers
// its players while another plugin reports a call (deckbus state "call", from SA-C), and puts them
// back afterwards. Per player, chosen by the user, off by default; kept in the global setting
// `callReaction` ({ "<player>": "pause" | "duck" }), so every settings window shows the same.
// Only what this did is undone, and only when the user didn't change it meanwhile. Kept SDK-free.
import type { DeckBus, PeerInfo } from '../bus/bus.js';
import type { PlayerBoard, PlayerEntry } from './players.js';

export type CallMode = 'pause' | 'duck';
/** The global setting with each player's choice. */
export const CALL_SETTING = 'callReaction';
/** "duck" lowers to this share of the player's volume (at least 1). */
export const CALL_DUCK_SHARE = 0.25;
/** The PI's list (pushed as this event): this plugin's players and their choice. */
export const CALL_PLAYERS_EVENT = 'kit-call-players';

export type CallPlayerRow = { player: string; name: string; mode?: CallMode };
type Log = { info(m: string): void; warn(m: string): void };

/** Whether some peer can tell about calls at all (has the state "call"): only then the settings show the section. */
export function callsAvailable(peers: readonly PeerInfo[]): boolean {
    return peers.some((p) => p.state.call !== undefined && p.state.call !== null);
}

/** The call some peer reports now, if any. */
export function callOf(peers: readonly PeerInfo[]): { app?: string; name?: string } | undefined {
    for (const p of peers) {
        const c = p.state.call as { active?: unknown; app?: unknown; name?: unknown } | undefined;
        if (c?.active === true) return { app: typeof c.app === 'string' ? c.app : undefined, name: typeof c.name === 'string' ? c.name : undefined };
    }
    return undefined;
}

/** The choices from the global setting (anything else is ignored). */
export function parseCallChoices(raw: unknown): Record<string, CallMode> {
    const out: Record<string, CallMode> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (v === 'pause' || v === 'duck') out[k] = v;
    return out;
}

export class CallReaction {
    private choices: Record<string, CallMode> = {};
    private inCall = false;
    private available = false;
    /** Players this paused, and players this lowered (from → to). */
    private readonly paused = new Set<string>();
    private readonly ducked = new Map<string, { from: number; to: number }>();

    /** `changed`: told when calls become available or go away (e.g. to push the PI again). */
    constructor(
        private readonly board: Pick<PlayerBoard, 'ownPlayers' | 'command'>,
        private readonly log: Log = console,
        private readonly changed: () => void = () => {},
    ) {}

    connect(bus: Pick<DeckBus, 'onPeers'>): void {
        bus.onPeers((peers) => this.setPeers(peers));
    }

    /** The user's choices, from the global settings (call on every change). */
    setChoices(raw: unknown): void {
        this.choices = parseCallChoices(raw);
    }

    /** The PI message: players, choices, and whether some plugin reports calls (else the section hides). */
    piMessage(): { event: typeof CALL_PLAYERS_EVENT; available: boolean; players: CallPlayerRow[] } {
        return { event: CALL_PLAYERS_EVENT, available: this.available, players: this.rows() };
    }

    /** For the settings window: this plugin's players and their choice. */
    rows(): CallPlayerRow[] {
        return this.board.ownPlayers().map((p) => ({ player: p.player, name: p.name, ...(this.choices[p.player] ? { mode: this.choices[p.player] } : {}) }));
    }

    /** The peers now (from connect(), or from whoever listens to the bus). */
    setPeers(peers: readonly PeerInfo[]): Promise<void> {
        const available = callsAvailable(peers);
        if (available !== this.available) {
            this.available = available;
            this.changed();
        }
        const call = callOf(peers);
        if (!!call === this.inCall) return Promise.resolve();
        this.inCall = !!call;
        return call ? this.start(call.name ?? call.app ?? 'a call') : this.end();
    }

    private async start(who: string): Promise<void> {
        for (const p of this.board.ownPlayers()) {
            const mode = this.choices[p.player];
            if (!mode || !p.playing) continue;
            if (mode === 'pause') {
                if (await this.run(p, 'pause')) this.paused.add(p.player);
            } else if (p.volume !== undefined) {
                const from = p.volume;
                const to = Math.max(1, Math.round(from * CALL_DUCK_SHARE));
                if (to < from && (await this.run(p, 'volume', to))) this.ducked.set(p.player, { from, to });
            }
        }
        if (this.paused.size || this.ducked.size) this.log.info(`[call] ${who}: paused ${this.paused.size}, lowered ${this.ducked.size}`);
    }

    private async end(): Promise<void> {
        const now = new Map(this.board.ownPlayers().map((p) => [p.player, p]));
        for (const id of this.paused) {
            const p = now.get(id);
            // Playing again (the user pressed play) or gone: nothing to put back
            if (p && !p.playing) await this.run(p, 'play');
        }
        for (const [id, { from, to }] of this.ducked) {
            const p = now.get(id);
            // Changed during the call: the user's volume stays
            if (p?.volume !== undefined && Math.abs(p.volume - to) <= 1) await this.run(p, 'volume', from);
        }
        this.paused.clear();
        this.ducked.clear();
    }

    private async run(p: PlayerEntry, command: 'pause' | 'play' | 'volume', value?: number): Promise<boolean> {
        try {
            await this.board.command(p.player, command, value);
            return true;
        } catch (e) {
            this.log.warn(`[call] ${command} on ${p.name} failed: ${e instanceof Error ? e.message : String(e)}`);
            return false;
        }
    }
}
