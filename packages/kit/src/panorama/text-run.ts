// Text across a run of Panorama dials, over plugin borders (grilled 2026-10-10: "Das muss
// übergreifend sein, das ist der Sinn des deckbus"). Dials that carry text mark themselves in the
// shared "actions" state (`canvas: true`); the one that shows text puts the text there too. Every
// plugin works out the same run from that: adjacent canvas dials on one device, left to right.
// The dial whose text changed last decides what the run shows (the fastest source wins: Music
// Assistant reports a Spotify skip seconds after Sonos does; ties go to the leftmost), and each
// display draws its own 200 px window of it (render/panorama-text.ts), so a title can start on MA-C's dial and end on SO-C's.
import type { ActionsState } from "../bus/actions.js";
import { peerActions } from "../bus/actions.js";
import type { DeckBus, PeerInfo } from "../bus/bus.js";

/** What a run shows: title and artist, or a sung lyrics line with the next one. */
export type RunText = { kind: "track"; title: string; artist: string } | { kind: "lyrics"; current: string; next: string };

/** One display of a run: the run's whole width, this display's window into it, and what the run shows. */
export type TextRunView = {
    /** Same for every display of the run (device and first column) — keeps a crossfade in step. */
    key: string;
    width: number;
    offset: number;
    /** Position of this display in the run, 0 = leftmost. */
    index: number;
    /** Number of displays. */
    length: number;
    /** What the run shows (undefined: no dial of it shows text). */
    text?: RunText;
    /** When that text last changed (ms, the source dial's clock; 0 = unknown). */
    at: number;
    /** True when the text comes from a dial of this plugin (it then knows more than the bus carries). */
    local: boolean;
};

type Dial = { device: string; column: number; text?: RunText; at: number; local: boolean };
type Own = { device: string; column: number; text?: RunText; at: number; redraw: () => void; last?: string };

const STRIP_WIDTH = 200;

/** The text dial's `text` field from the bus, when it is well formed. */
function parseText(value: unknown): RunText | undefined {
    const t = value as Record<string, unknown> | null;
    if (!t || typeof t !== "object") return undefined;
    if (t.kind === "track" && typeof t.title === "string" && typeof t.artist === "string") return { kind: "track", title: t.title, artist: t.artist };
    if (t.kind === "lyrics" && typeof t.current === "string") return { kind: "lyrics", current: t.current, next: typeof t.next === "string" ? t.next : "" };
    return undefined;
}

/**
 * The runs of Panorama dials with text: this plugin's own dials plus every peer's `canvas` dials.
 * Own dials report themselves (`set`, `setText`, `remove`); `run(context)` answers what a display
 * draws, and a dial's `redraw` is called when a neighbour's text or place changed under it.
 */
export class TextRuns {
    private readonly own = new Map<string, Own>();
    private peers: PeerInfo[] = [];

    constructor(private readonly actions?: Pick<ActionsState, "update">) {}

    /** Follow the other plugins' dials over deckbus (call once the bus runs). */
    connect(bus: Pick<DeckBus, "onPeers">): () => void {
        const off = bus.onPeers((peers) => {
            this.peers = peers;
            this.changed();
        });
        return () => {
            off();
            this.peers = [];
            this.changed();
        };
    }

    /** A text-capable dial appeared (or moved); `text` is what it shows itself, if anything. */
    set(context: string, at: { device: string; column: number }, text: RunText | undefined, redraw: () => void): void {
        const prev = this.own.get(context);
        const sameText = prev && JSON.stringify(prev.text) === JSON.stringify(text);
        const stamp = sameText ? prev.at : Date.now();
        this.own.set(context, { ...at, text, at: stamp, redraw, last: prev?.last });
        this.actions?.update(context, { canvas: true, text, textAt: stamp });
        this.changed();
    }

    /** What an own dial shows changed (undefined: it shows no text). */
    setText(context: string, text: RunText | undefined): void {
        const d = this.own.get(context);
        if (!d || JSON.stringify(d.text) === JSON.stringify(text)) return;
        d.text = text;
        d.at = Date.now();
        this.actions?.update(context, { text, textAt: d.at });
        this.changed();
    }

    remove(context: string): void {
        if (!this.own.delete(context)) return;
        this.actions?.update(context, { canvas: undefined, text: undefined, textAt: undefined });
        this.changed();
    }

    /** The run an own dial sits in, as its display draws it. */
    run(context: string): TextRunView | undefined {
        const d = this.own.get(context);
        if (!d) return undefined;
        const byColumn = new Map<number, Dial>();
        for (const peer of this.peers) {
            for (const a of peerActions(peer)) {
                if (a.device !== d.device || a.controller !== "Encoder" || a.canvas !== true) continue;
                byColumn.set(a.column, { device: a.device, column: a.column, text: parseText(a.text), at: typeof a.textAt === "number" ? a.textAt : 0, local: false });
            }
        }
        // Own dials win over a stale peer entry at the same place
        for (const o of this.own.values()) if (o.device === d.device) byColumn.set(o.column, { device: o.device, column: o.column, text: o.text, at: o.at, local: true });
        let first = d.column;
        while (byColumn.has(first - 1)) first--;
        let last = d.column;
        while (byColumn.has(last + 1)) last++;
        let source: Dial | undefined;
        for (let c = first; c <= last; c++) {
            const dial = byColumn.get(c);
            if (dial?.text && (!source || dial.at > source.at)) source = dial;
        }
        const length = last - first + 1;
        return {
            key: `${d.device}/${first}`,
            width: length * STRIP_WIDTH,
            offset: (d.column - first) * STRIP_WIDTH,
            index: d.column - first,
            length,
            text: source?.text,
            at: source?.at ?? 0,
            local: source?.local ?? true,
        };
    }

    /** Own dials whose run, window or text differ from what they last drew are asked to redraw. */
    private changed(): void {
        for (const [context, d] of this.own) {
            const view = this.run(context);
            const signature = JSON.stringify(view);
            if (signature === d.last) continue;
            d.last = signature;
            d.redraw();
        }
    }
}
