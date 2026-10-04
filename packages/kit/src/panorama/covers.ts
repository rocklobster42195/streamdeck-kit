// The colour of what is playing, shared on deckbus (state "covers"; grills 2026-10-02 cover colour
// over the bus, 2026-10-03 row cover colour). Music plugins (MA-C, SO-C) publish one entry per
// player; any plugin resolves a colour choice from all of them, so a Panorama row can follow the
// cover even when none of its dials belongs to a music plugin.
//
// A colour choice is a string: "cover" (the active player: the one that started playing last, or
// the last one that played), "cover:<plugin>/<player>" (one player), "#RRGGBB" (fixed) or
// "default" (the effect's own colour).
import type { DeckBus, PeerInfo } from '../bus/bus.js';

export const COVERS_KEY = 'covers';
/** The "players" state (players/players.ts), read here for its colours. */
const PLAYERS_STATE = 'players';

/** One player as a music plugin publishes it. */
export type CoverEntry = {
    player: string;
    /** For people: "Living Room". */
    name: string;
    /** The cover's colour, already made readable by the sender (minimum brightness and saturation). */
    color: string;
    playing: boolean;
    /** When it last started playing (ms); kept while paused, so "the last one that played" works. */
    since: number;
    /** The physical device, when other plugins can know it too (see players: "device"). */
    device?: string;
    /** The plugin talks to the device directly (its colour wins for that device). */
    direct?: boolean;
};

/** An entry with the plugin it comes from. */
export type CoverSource = CoverEntry & { source: string; id: string };

export const COVER_CHOICE = 'cover';
export const DEFAULT_CHOICE = 'default';

export class CoverBoard {
    private own: CoverEntry[] = [];
    private peers: PeerInfo[] = [];
    private bus: Pick<DeckBus, 'setState'> | undefined;
    private readonly listeners = new Set<() => void>();
    private last = '';

    /** `name`: this plugin's short name (e.g. "MA-C"), shown with its players. */
    constructor(private readonly name: string) {}

    connect(bus: Pick<DeckBus, 'onPeers' | 'setState'>): void {
        this.bus = bus;
        bus.onPeers((peers) => this.setPeers(peers));
        if (this.own.length) bus.setState(COVERS_KEY, this.own);
    }

    /** The peers, when someone else listens to the bus for us (PanoramaRows' own board). */
    setPeers(peers: PeerInfo[]): void {
        this.peers = peers;
        this.changed();
    }

    /** This plugin's players (a music plugin calls it whenever a cover or play state changes). */
    publish(entries: CoverEntry[]): void {
        if (JSON.stringify(entries) === JSON.stringify(this.own)) return;
        this.own = entries;
        this.bus?.setState(COVERS_KEY, entries.length ? entries : undefined);
        this.changed();
    }

    /** Every player of every plugin, ours first; one device known to two plugins once (the direct one's colour). */
    sources(): CoverSource[] {
        const all = this.allSources();
        return all.filter((s) => !s.device || s.direct || !all.some((o) => o !== s && o.device === s.device && o.direct));
    }

    private allSources(): CoverSource[] {
        const out: CoverSource[] = this.own.map((e) => ({ ...e, source: this.name, id: `${this.name}/${e.player}` }));
        for (const peer of this.peers) {
            // A peer with "players" (a superset, docs "players") is read from there; older ones from "covers"
            const players = peer.state[PLAYERS_STATE];
            const list = Array.isArray(players) ? players : peer.state[COVERS_KEY];
            if (!Array.isArray(list)) continue;
            for (const e of list as CoverEntry[]) {
                if (e && typeof e.player === 'string' && typeof e.color === 'string') out.push({ ...e, source: peer.name, id: `${peer.name}/${e.player}` });
            }
        }
        return out;
    }

    /** The colour for a choice; undefined when it has none right now (then the effect's own colour). */
    resolve(choice: string | undefined): string | undefined {
        const c = choice || COVER_CHOICE;
        if (c === DEFAULT_CHOICE) return undefined;
        if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        const all = this.sources();
        if (c.startsWith(`${COVER_CHOICE}:`)) return all.find((s) => s.id === c.slice(COVER_CHOICE.length + 1))?.color;
        return activeSource(all)?.color;
    }

    /** Called whenever the players or their colours change. */
    onChange(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private changed(): void {
        const json = JSON.stringify(this.sources());
        if (json === this.last) return;
        this.last = json;
        for (const fn of this.listeners) fn();
    }
}

/** The player that started playing last; none playing → the one that played last. */
export function activeSource<T extends CoverEntry>(all: T[]): T | undefined {
    const latest = (list: T[]) => list.reduce<T | undefined>((a, b) => (!a || b.since > a.since ? b : a), undefined);
    return latest(all.filter((s) => s.playing)) ?? latest(all);
}

/**
 * A cover colour made readable on black, the same in every sender: saturation and brightness
 * raised to a minimum (HSV), so "on" and an effect stay distinguishable from grey.
 */
/** Below this saturation a colour counts as grey (its hue isn't raised). */
const NEAR_GREY = 0.1;

export function readableCoverColor([r, g, b]: [number, number, number], minSaturation = 0.35, minValue = 0.75): string {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const d = max - min;
    let h = 0;
    if (d > 0) {
        const [rn, gn, bn] = [r / 255, g / 255, b / 255];
        h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    // A grey (or almost grey) cover keeps its grey: raising the faint hue of a near-grey made
    // e.g. a pale beige (208,203,201) salmon (seen 2026-10-04)
    const sat = max === 0 ? 0 : d / max;
    const s = sat < NEAR_GREY ? sat : Math.max(minSaturation, sat);
    const v = Math.max(minValue, max);
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const hex = (n: number) => Math.round((n + v - c) * 255).toString(16).padStart(2, '0');
    return `#${hex(r1)}${hex(g1)}${hex(b1)}`;
}
