// One Panorama across the dials of several plugins (grill 2026-10-01, notes/2026-10-01-cross-
// plugin-panorama-grill.md). Every plugin wraps its PanoramaEngine in a SharedPanorama and hands
// it the deckbus. From all peers' "actions" (where their dials sit and which effect they show)
// every plugin works out the same groups: adjacent dials on one device with the same effect,
// whichever plugin they belong to. The plugin with the group's leftmost dial leads: it runs the
// effect over the whole group (other plugins' dials join its engine as virtual members) and
// publishes each foreign dial's slice on "panorama/<device>/<column>". The others don't run that
// group themselves; their dials subscribe and draw the slice they get. Without the bus, or with
// nobody next to them, everything runs locally as before.
//
// Same API as PanoramaEngine for the dial actions (join, leave, renderSlice, …), so a plugin only
// swaps the instance and calls connect(bus).
import type { ActionsState } from "../bus/actions.js";
import { peerActions } from "../bus/actions.js";
import type { DeckBus, PeerInfo } from "../bus/bus.js";
import type { PanoramaEngine } from "./engine.js";

/** The parts of the bus the shared Panorama uses (a fake in tests). */
export type PanoramaBus = Pick<DeckBus, "onPeers" | "publish" | "subscribe">;

/** How a dial takes part: on its own plugin's engine, leading a shared group, or following one. */
export type PanoramaRole = { role: "local" } | { role: "leader" } | { role: "follower"; leader: string };

type OwnDial = { device: string; column: number; effect: string; settings: Record<string, unknown>; redraw: () => void };
type Slot = { owner: string; ownerName: string; device: string; column: number; effect: string; context?: string };

const SELF = "\u0000self";

/** Topic of one dial's slice. */
export function panoramaTopic(device: string, column: number): string {
    return `panorama/${device}/${column}`;
}

/**
 * Groups over all dials: per device, runs of adjacent columns with the same effect. Each group is
 * sorted left to right, so its first slot is the leader.
 */
export function sharedGroups(slots: Slot[]): Slot[][] {
    const groups: Slot[][] = [];
    const byDevice = new Map<string, Slot[]>();
    for (const s of slots) {
        let list = byDevice.get(s.device);
        if (!list) byDevice.set(s.device, (list = []));
        list.push(s);
    }
    for (const list of byDevice.values()) {
        list.sort((a, b) => a.column - b.column);
        let run: Slot[] = [];
        for (const s of list) {
            const last = run[run.length - 1];
            if (last && (s.column !== last.column + 1 || s.effect !== last.effect)) {
                groups.push(run);
                run = [];
            }
            run.push(s);
        }
        if (run.length) groups.push(run);
    }
    return groups;
}

export class SharedPanorama {
    private readonly own = new Map<string, OwnDial>();
    /** Own dials currently joined to the local engine. */
    private readonly joined = new Set<string>();
    /** Virtual members for other plugins' dials this plugin leads: virtual context → topic. */
    private readonly virtuals = new Map<string, string>();
    /** Own dials that follow another plugin: context → { leader, unsubscribe, latest slice }. */
    private readonly following = new Map<string, { leader: string; topic: string; off: () => void; svg: string }>();
    /** Own dials leading a group with other plugins' dials in it. */
    private readonly leading = new Set<string>();
    private bus: PanoramaBus | undefined;
    private peers: PeerInfo[] = [];

    constructor(
        readonly engine: PanoramaEngine,
        private readonly actions?: Pick<ActionsState, "update">,
    ) {}

    /** Share with the other plugins over deckbus (call once the bus runs; before that all is local). */
    connect(bus: PanoramaBus): () => void {
        this.bus = bus;
        const off = bus.onPeers((peers) => {
            this.peers = peers;
            this.recompute();
        });
        return () => {
            off();
            this.bus = undefined;
            this.peers = [];
            this.recompute();
        };
    }

    // ---- the engine's API for dial actions -----------------------------------------------------

    join(context: string, deviceId: string, column: number, effectId: string, settings: Record<string, unknown>, redraw: () => void): void {
        const prev = this.own.get(context);
        this.own.set(context, { device: deviceId, column, effect: effectId, settings, redraw });
        // Others see where this dial is and which effect it wants (its position comes from trackActions)
        this.actions?.update(context, { effect: effectId });
        if (prev && prev.device === deviceId && prev.column === column && prev.effect === effectId) {
            if (this.joined.has(context)) this.engine.join(context, deviceId, column, effectId, settings, redraw);
            return;
        }
        this.recompute();
    }

    leave(context: string): void {
        if (!this.own.delete(context)) return;
        this.actions?.update(context, { effect: undefined });
        this.recompute();
    }

    updateSettings(context: string, settings: Record<string, unknown>): void {
        const d = this.own.get(context);
        if (d) d.settings = settings;
        if (this.joined.has(context)) this.engine.updateSettings(context, settings);
    }

    setLevel(context: string, level: number | undefined): void {
        if (this.joined.has(context)) this.engine.setLevel(context, level);
    }

    /** The dial's slice: from its own engine, or the one the leading plugin sent last. */
    renderSlice(context: string): string {
        const f = this.following.get(context);
        return f ? f.svg : this.engine.renderSlice(context);
    }

    isActive(context: string): boolean {
        return this.following.has(context) || this.engine.isActive(context);
    }

    /** Members of the local group (a following dial has none here: the leading plugin runs it). */
    members(context: string): { context: string; column: number }[] {
        return this.joined.has(context) ? this.engine.members(context).filter((m) => !this.virtuals.has(m.context)) : [];
    }

    role(context: string): PanoramaRole {
        const f = this.following.get(context);
        if (f) return { role: "follower", leader: f.leader };
        return this.leading.has(context) ? { role: "leader" } : { role: "local" };
    }

    rotate(context: string, ticks: number): void {
        if (this.joined.has(context)) this.engine.rotate(context, ticks);
    }

    press(context: string): void {
        if (this.joined.has(context)) this.engine.press(context);
    }

    touch(context: string, x: number, y: number): void {
        if (this.joined.has(context)) this.engine.touch(context, x, y);
    }

    controls(context: string): string[] {
        return this.joined.has(context) ? this.engine.controls(context) : [];
    }

    control(context: string): string | undefined {
        return this.joined.has(context) ? this.engine.control(context) : undefined;
    }

    setControl(context: string, id: string): void {
        if (this.joined.has(context)) this.engine.setControl(context, id);
    }

    runtimeSettings(context: string): Record<string, unknown> | undefined {
        return this.joined.has(context) ? this.engine.runtimeSettings(context) : undefined;
    }

    indicator(context: string): number | undefined {
        return this.joined.has(context) ? this.engine.indicator(context) : undefined;
    }

    dispose(): void {
        for (const f of this.following.values()) f.off();
        this.following.clear();
        this.engine.dispose();
    }

    // ---- grouping across plugins ------------------------------------------------------------------

    private recompute(): void {
        const slots: Slot[] = [];
        for (const [context, d] of this.own) slots.push({ owner: SELF, ownerName: "", device: d.device, column: d.column, effect: d.effect, context });
        if (this.bus) {
            for (const peer of this.peers) {
                for (const a of peerActions(peer)) {
                    if (a.controller !== "Encoder" || typeof a.effect !== "string") continue;
                    slots.push({ owner: peer.id, ownerName: peer.name, device: a.device, column: a.column, effect: a.effect });
                }
            }
        }

        const wantJoined = new Set<string>();
        const wantVirtual = new Map<string, { device: string; column: number; effect: string; topic: string }>();
        const wantFollow = new Map<string, { leader: string; topic: string }>();
        this.leading.clear();
        for (const group of sharedGroups(slots)) {
            const mine = group.filter((s) => s.owner === SELF);
            if (!mine.length) continue;
            const leader = group[0];
            if (leader.owner === SELF) {
                // Leading (or alone): own dials on the engine, foreign ones as virtual members
                for (const s of mine) wantJoined.add(s.context!);
                if (group.some((s) => s.owner !== SELF)) for (const s of mine) this.leading.add(s.context!);
                for (const s of group) {
                    if (s.owner === SELF) continue;
                    const topic = panoramaTopic(s.device, s.column);
                    wantVirtual.set(`virtual:${topic}`, { device: s.device, column: s.column, effect: s.effect, topic });
                }
            } else {
                for (const s of mine) wantFollow.set(s.context!, { leader: leader.ownerName, topic: panoramaTopic(s.device, s.column) });
            }
        }

        // Followers first leave the local engine, so it never runs a group twice
        for (const [context, f] of [...this.following]) {
            const want = wantFollow.get(context);
            if (want && want.topic === f.topic && want.leader === f.leader) continue;
            f.off();
            this.following.delete(context);
        }
        for (const context of [...this.joined]) {
            if (wantJoined.has(context)) continue;
            this.engine.leave(context);
            this.joined.delete(context);
        }
        for (const [v] of [...this.virtuals]) {
            if (wantVirtual.has(v)) continue;
            this.engine.leave(v);
            this.virtuals.delete(v);
        }
        for (const context of wantJoined) {
            const d = this.own.get(context)!;
            this.engine.join(context, d.device, d.column, d.effect, d.settings, d.redraw);
            this.joined.add(context);
        }
        for (const [v, s] of wantVirtual) {
            // Each tick, the slice for the other plugin's dial goes out on its topic
            this.engine.join(v, s.device, s.column, s.effect, {}, () => this.bus?.publish(s.topic, this.engine.renderSlice(v)));
            this.virtuals.set(v, s.topic);
        }
        for (const [context, want] of wantFollow) {
            if (this.following.has(context) || !this.bus) continue;
            const entry = { leader: want.leader, topic: want.topic, svg: "", off: () => {} };
            entry.off = this.bus.subscribe(want.topic, (data) => {
                if (typeof data !== "string") return;
                entry.svg = data;
                this.own.get(context)?.redraw();
            });
            this.following.set(context, entry);
            this.own.get(context)?.redraw();
        }
    }
}

