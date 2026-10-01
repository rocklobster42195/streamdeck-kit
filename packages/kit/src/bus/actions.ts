// The shared state "actions" (docs/deckbus-protocol.md): where a peer's visible actions sit on
// which device, so plugins can tell who is next to them (e.g. one Panorama across dials of two
// plugins). Kept SDK-free; `trackActions` in the kit's /bridge feeds it from the Stream Deck SDK.
import type { DeckBus, PeerInfo } from "./bus.js";

export type Controller = "Keypad" | "Encoder";

/** One visible action, as shared on the bus. */
export type BusAction = {
    /** Stream Deck device id. */
    device: string;
    column: number;
    row: number;
    controller: Controller;
    /** The action's UUID, e.g. "de.boriskemper.music-assistant-controller.panorama-dial". */
    action: string;
    /** The Panorama effect it shows, if any (e.g. "boing-ball"). */
    effect?: string;
    [extra: string]: unknown;
};

export type Neighbour = { peer: PeerInfo; action: BusAction; side: "left" | "right" | "up" | "down" };

/** Keeps this peer's "actions" state; changes go out together after `delayMs`. */
export class ActionsState {
    private readonly actions = new Map<string, BusAction>();
    /**
     * Fields set through update() per context, kept so set() keeps them: the Stream Deck SDK may
     * call the plugin's own willAppear (which sets e.g. the effect) before trackActions' one.
     */
    private readonly extras = new Map<string, Partial<BusAction>>();
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly bus: Pick<DeckBus, "setState">,
        private readonly delayMs = 100,
    ) {}

    /** An action appeared (or changed): `context` is its Stream Deck context id. */
    set(context: string, action: BusAction): void {
        const next = { ...action, ...this.extras.get(context) };
        for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
        this.actions.set(context, next);
        this.schedule();
    }

    /** Merge fields into a visible action (e.g. its effect after a settings change). */
    update(context: string, patch: Partial<BusAction>): void {
        this.extras.set(context, { ...this.extras.get(context), ...patch });
        const current = this.actions.get(context);
        if (!current) return;
        const next = { ...current, ...patch };
        for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        this.actions.set(context, next);
        this.schedule();
    }

    remove(context: string): void {
        this.extras.delete(context);
        if (this.actions.delete(context)) this.schedule();
    }

    list(): BusAction[] {
        return [...this.actions.values()].sort((a, b) => a.device.localeCompare(b.device) || a.controller.localeCompare(b.controller) || a.row - b.row || a.column - b.column);
    }

    private schedule(): void {
        if (this.timer) return;
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.bus.setState("actions", this.list());
        }, this.delayMs);
    }
}

/** The "actions" state of a peer (an empty list when it shares none or something malformed). */
export function peerActions(peer: PeerInfo): BusAction[] {
    const list = peer.state.actions;
    return Array.isArray(list) ? (list as BusAction[]).filter((a) => a && typeof a.device === "string" && Number.isInteger(a.column) && Number.isInteger(a.row)) : [];
}

/**
 * Other peers' actions directly next to `at` on the same device and of the same controller kind
 * (dials sit in one row, so for them only left and right count).
 */
export function neighbours(peers: PeerInfo[], at: Pick<BusAction, "device" | "column" | "row" | "controller">): Neighbour[] {
    const out: Neighbour[] = [];
    for (const peer of peers) {
        for (const action of peerActions(peer)) {
            if (action.device !== at.device || action.controller !== at.controller) continue;
            const dc = action.column - at.column;
            const dr = action.row - at.row;
            if (dr === 0 && Math.abs(dc) === 1) out.push({ peer, action, side: dc < 0 ? "left" : "right" });
            else if (dc === 0 && Math.abs(dr) === 1 && at.controller === "Keypad") out.push({ peer, action, side: dr < 0 ? "up" : "down" });
        }
    }
    return out;
}
