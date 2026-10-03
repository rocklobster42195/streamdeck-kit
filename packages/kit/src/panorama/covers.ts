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

    /** Every player of every plugin, ours first. */
    sources(): CoverSource[] {
        const out: CoverSource[] = this.own.map((e) => ({ ...e, source: this.name, id: `${this.name}/${e.player}` }));
        for (const peer of this.peers) {
            const list = peer.state[COVERS_KEY];
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
