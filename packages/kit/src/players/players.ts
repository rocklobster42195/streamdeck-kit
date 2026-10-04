// Players on deckbus (docs/deckbus-protocol.md, "players"; grill 2026-10-04): every plugin with
// something playable publishes its players, and any plugin's keys can control any of them. One
// physical device seen by two plugins (a Sonos speaker via SO-C and via MA-C) is one player:
// commands go to the plugin that talks to it directly, title and cover come from the plugin whose
// media plays. Kept SDK-free.
import type { DeckBus, PeerInfo } from '../bus/bus.js';

export const PLAYERS_KEY = 'players';
export const TRANSPORT_METHOD = 'transport';

export type PlayerKind = 'speaker' | 'app';
export type RepeatMode = 'off' | 'all' | 'one';
export type TransportCommand = 'play-pause' | 'play' | 'pause' | 'next' | 'previous' | 'seek' | 'volume' | 'volume-by' | 'mute' | 'shuffle' | 'repeat';

export const TRANSPORT_COMMANDS: readonly TransportCommand[] = ['play-pause', 'play', 'pause', 'next', 'previous', 'seek', 'volume', 'volume-by', 'mute', 'shuffle', 'repeat'];

/** One player as a plugin publishes it. Missing fields mean unknown. */
export type PlayerEntry = {
    /** The plugin's own id for it. */
    player: string;
    /** The physical device, when other plugins can know it too (Sonos: "RINCON_…"). */
    device?: string;
    /** For people: "Badezimmer", "Küche + 2", "Spotify". */
    name: string;
    kind: PlayerKind;
    /** For kind "app": the application, so a choice survives the app restarting. */
    app?: string;
    /** The plugin talks to the device itself, not through a server. */
    direct?: boolean;
    /** What plays right now comes from this plugin (its queue or session). */
    media?: boolean;
    playing: boolean;
    /** When it last started playing (ms), kept while paused. */
    since: number;
    /** The cover's colour, readable on black (see readableCoverColor). */
    color?: string;
    title?: string;
    artist?: string;
    album?: string;
    /** A cover image URL this computer can load. */
    cover?: string;
    /** Seconds; `at` is when (ms) `position` was true. */
    position?: number;
    duration?: number;
    at?: number;
    /** 0–100 */
    volume?: number;
    muted?: boolean;
    shuffle?: boolean;
    repeat?: RepeatMode;
    /** The commands the player takes now. */
    can?: TransportCommand[];
};

/** Where an entry comes from: a peer, or this plugin itself (no peer). */
export type PlayerRoute = { source: string; peer?: PeerInfo; entry: PlayerEntry };

/** One player of the deck, merged from every plugin that knows it. */
export type Player = PlayerEntry & {
    /** Its choice id: "device:…", "app:…" or "<plugin>/<player>". */
    id: string;
    /** Every plugin that knows it. */
    routes: PlayerRoute[];
    /** Where commands go. */
    via: PlayerRoute;
    /** Where title, cover and position come from. */
    from: PlayerRoute;
};

export type Transport = { player: string; command: TransportCommand; value?: unknown };
export type TransportHandler = (t: Transport) => unknown;

/**
 * Commands about what plays (not about the device): they go to the plugin whose media plays.
 * Seen 2026-10-04: a Sonos speaker playing Music Assistant's stream can't seek in it through
 * Sonos; MA has to start its stream at the new position.
 */
export const MEDIA_COMMANDS: readonly TransportCommand[] = ['seek', 'next', 'previous', 'shuffle', 'repeat'];

/** Where a command for a merged player goes: its media's plugin for media commands, else the direct one. */
export function routeFor(p: Player, command: TransportCommand): PlayerRoute {
    return MEDIA_COMMANDS.includes(command) && p.from.entry.media ? p.from : p.via;
}

/** "active": the active speaker; "active:all": including apps. */
export const ACTIVE_PLAYER = 'active';
export const ACTIVE_ANY_PLAYER = 'active:all';

/** Checks a "transport" request's params; throws on a bad player or command. */
export function parseTransport(params: unknown): Transport {
    const p = (params ?? {}) as Record<string, unknown>;
    if (typeof p.player !== 'string' || !p.player) throw new Error('transport: player missing');
    if (!TRANSPORT_COMMANDS.includes(p.command as TransportCommand)) throw new Error(`transport: unknown command ${String(p.command)}`);
    const command = p.command as TransportCommand;
    const value = p.value;
    const num = () => {
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`transport: ${command} needs a number`);
    };
    if (command === 'seek' || command === 'volume' || command === 'volume-by') num();
    if ((command === 'mute' || command === 'shuffle') && typeof value !== 'boolean') throw new Error(`transport: ${command} needs true or false`);
    if (command === 'repeat' && value !== 'off' && value !== 'all' && value !== 'one') throw new Error('transport: repeat needs off, all or one');
    return value === undefined ? { player: p.player, command } : { player: p.player, command, value };
}

/** Where a playing player is now (seconds), counting on from `at`; undefined without a position. */
export function positionNow(p: Pick<PlayerEntry, 'position' | 'duration' | 'at' | 'playing'>, now = Date.now()): number | undefined {
    if (p.position === undefined) return undefined;
    const pos = p.playing && p.at !== undefined ? p.position + Math.max(0, now - p.at) / 1000 : p.position;
    return p.duration ? Math.min(pos, p.duration) : pos;
}

/** The player that started playing last; none playing → the one that played last. */
function latest<T extends { playing: boolean; since: number }>(all: T[]): T | undefined {
    const pick = (list: T[]) => list.reduce<T | undefined>((a, b) => (!a || b.since > a.since ? b : a), undefined);
    return pick(all.filter((p) => p.playing)) ?? pick(all);
}

/** Merges routes of one player: commands to a direct route, media from the route whose media plays. */
function merge(id: string, routes: PlayerRoute[]): Player {
    const via = routes.find((r) => r.entry.direct) ?? routes.find((r) => !r.peer) ?? routes[0];
    const media = routes.filter((r) => r.entry.media);
    const from = media.find((r) => r.entry.playing) ?? media[0] ?? via;
    const v = via.entry;
    const f = from.entry;
    return {
        ...f,
        player: v.player,
        device: v.device ?? f.device,
        name: v.name,
        kind: v.kind,
        app: v.app ?? f.app,
        direct: v.direct,
        // The colour from the plugin that talks to the device directly: plugins work a cover's colour
        // out differently (SO-C from the image, MA-C from Music Assistant's palette), and the direct
        // one's dials already show its own (seen 2026-10-04: blue from SO-C, salmon from MA-C)
        color: v.color ?? f.color,
        playing: routes.some((r) => r.entry.playing),
        since: Math.max(...routes.map((r) => r.entry.since)),
        volume: v.volume ?? f.volume,
        muted: v.muted ?? f.muted,
        shuffle: v.shuffle ?? f.shuffle,
        repeat: v.repeat ?? f.repeat,
        can: v.can,
        id,
        routes,
        via,
        from,
    };
}

/** An entry of the player dropdown (the PI's <pi-select>, see PiBridge.registerOptions). */
export type PlayerOption = { value: string; label: string; sub?: string };

/**
 * The player dropdown: "Active player", "Active player, also apps", then every player of the deck
 * (▶ while playing; second line: the plugins that know it). The active entries' labels are kit
 * texts the PI translates. `kind` limits the list (e.g. "speaker" for a key that can't control apps).
 */
export function playerOptions(players: Player[], o: { kind?: PlayerKind } = {}): PlayerOption[] {
    const out: PlayerOption[] = [{ value: ACTIVE_PLAYER, label: 'kit.player_active' }];
    if (o.kind !== 'speaker') out.push({ value: ACTIVE_ANY_PLAYER, label: 'kit.player_active_all' });
    for (const p of players) {
        if (o.kind && p.kind !== o.kind) continue;
        out.push({ value: p.id, label: `${p.playing ? '▶ ' : ''}${p.name}`, sub: [...new Set(p.routes.map((r) => r.source))].join(' · ') });
    }
    return out;
}

function valid(e: unknown): e is PlayerEntry {
    const p = e as PlayerEntry;
    return !!p && typeof p.player === 'string' && typeof p.name === 'string' && typeof p.playing === 'boolean' && typeof p.since === 'number';
}

/**
 * This plugin's players and everyone else's: publish your own, read the deck's merged list, find a
 * key's player by its choice and send it commands (to yourself directly, to others over the bus).
 */
export class PlayerBoard {
    private own: PlayerEntry[] = [];
    private peers: PeerInfo[] = [];
    private bus: Pick<DeckBus, 'setState' | 'request'> | undefined;
    private handler: TransportHandler | undefined;
    private readonly listeners = new Set<() => void>();
    private last = '';

    /** `name`: this plugin's short name (e.g. "SO-C"). */
    constructor(private readonly name: string) {}

    connect(bus: Pick<DeckBus, 'onPeers' | 'setState' | 'request' | 'handle'>, o: { allow?: (peer: PeerInfo) => boolean } = {}): void {
        this.bus = bus;
        bus.handle(
            TRANSPORT_METHOD,
            (params) => {
                if (!this.handler) throw new Error('transport: no players here');
                const t = parseTransport(params);
                if (!this.own.some((e) => e.player === t.player)) throw new Error(`transport: unknown player ${t.player}`);
                return this.handler(t) ?? null;
            },
            o.allow ?? (() => true),
        );
        bus.onPeers((peers) => this.setPeers(peers));
        if (this.own.length) bus.setState(PLAYERS_KEY, this.own);
    }

    /** The peers, when someone else listens to the bus for us. */
    setPeers(peers: PeerInfo[]): void {
        this.peers = peers;
        this.changed();
    }

    /** This plugin's players (call it whenever one of them changes). */
    publish(entries: PlayerEntry[]): void {
        if (JSON.stringify(entries) === JSON.stringify(this.own)) return;
        this.own = entries;
        this.bus?.setState(PLAYERS_KEY, entries.length ? entries : undefined);
        this.changed();
    }

    /** Carries out commands for this plugin's own players (from its own keys and from other plugins). */
    serve(handler: TransportHandler): void {
        this.handler = handler;
    }

    /** Every player of the deck, merged by device (and by app), ours first. */
    players(): Player[] {
        const groups = new Map<string, PlayerRoute[]>();
        const add = (source: string, peer: PeerInfo | undefined, entry: PlayerEntry) => {
            const id = entry.device ? `device:${entry.device}` : entry.app ? `app:${entry.app}` : `${source}/${entry.player}`;
            const list = groups.get(id);
            if (list) list.push({ source, peer, entry });
            else groups.set(id, [{ source, peer, entry }]);
        };
        for (const e of this.own) add(this.name, undefined, e);
        for (const peer of this.peers) {
            const list = peer.state[PLAYERS_KEY];
            if (Array.isArray(list)) for (const e of list) if (valid(e)) add(peer.name, peer, e);
        }
        return [...groups].map(([id, routes]) => {
            // Two sessions of one app (two browser windows): the one that plays, or played last
            if (id.startsWith('app:') && routes.length > 1) {
                const pick = latest(routes.map((r) => r.entry))!;
                routes = routes.filter((r) => r.entry === pick);
            }
            return merge(id, routes);
        });
    }

    /** The active player: speakers only (`active`), or including apps (`active:all`). */
    active(all = false): Player | undefined {
        return latest(this.players().filter((p) => all || p.kind === 'speaker'));
    }

    /** A key's player by its choice: "active", "active:all", "device:…", "app:…" or "<plugin>/<player>". */
    resolve(choice: string | undefined): Player | undefined {
        const c = choice || ACTIVE_PLAYER;
        if (c === ACTIVE_PLAYER) return this.active(false);
        if (c === ACTIVE_ANY_PLAYER) return this.active(true);
        return this.players().find((p) => p.id === c);
    }

    /** Sends a command to a player (by choice or merged player); rejects when it can't. */
    async send(target: string | Player | undefined, command: TransportCommand, value?: unknown): Promise<unknown> {
        const p = typeof target === 'string' || target === undefined ? this.resolve(target) : target;
        if (!p) throw new Error('transport: no such player');
        const route = routeFor(p, command);
        const t = parseTransport({ player: route.entry.player, command, value });
        if (!route.peer) {
            if (!this.handler) throw new Error('transport: no players here');
            return this.handler(t);
        }
        if (!this.bus) throw new Error('transport: not on the bus');
        return this.bus.request(route.peer, TRANSPORT_METHOD, t);
    }

    /** Called whenever the deck's players change. */
    onChange(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private changed(): void {
        const json = JSON.stringify(this.players().map(({ via, from, routes, ...p }) => [p, via.source, from.source, routes.length]));
        if (json === this.last) return;
        this.last = json;
        for (const fn of this.listeners) fn();
    }
}
