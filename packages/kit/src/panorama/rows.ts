// One Panorama per row (grill 2026-10-02, notes/2026-10-02-panorama-rows-grill.md): all dials of a
// device form a row, whichever plugin they belong to, and the row has one effect with one set of
// settings. Choosing an effect on any dial sets it for the row. Each dial has a checkbox ("in the
// Panorama", default on); an unchecked dial is a silent member: it stays in the effect's geometry
// (so the effect runs on behind its neighbours) but draws nothing.
//
// Every dial stores the row (effect, settings, timestamp) in its settings; every plugin publishes
// its newest row per device (deckbus state "panorama-rows") and takes over a newer one, so the
// latest change wins across plugins. Checkboxes of other plugins' dials go there as a request
// ("panorama-member"). The PI's Panorama section (<pi-panorama>) talks to this class through the
// plugin's PI bridge (attachPi).
//
// The plugin registers its dials (add/remove/changed), draws the slice only for members
// (isMember + panorama.renderSlice) and keeps passing live values and levels to the panorama.
import { peerActions, type ActionsState, type BusAction } from '../bus/actions.js';
import type { DeckBus, PeerInfo } from '../bus/bus.js';
import { BACKGROUND_AUTO, BACKGROUND_NONE } from './backgrounds.js';
import { DEFAULT_EFFECT_ID, effectRegistry, listEffects, type EffectInfo } from './registry.js';
import type { SharedPanorama } from './shared.js';

/** "No effect" as a row's effect. */
export const ROW_NONE = 'none';

/** A row's effect, its settings and when it was chosen (ms; the latest wins). */
export type PanoramaRow = { effect: string; settings: Record<string, unknown>; stamp: number };

/** What a dial stores (in its settings: `panorama`, `panoramaMember`). */
export type RowDialState = { row?: PanoramaRow; member?: boolean };

/** A plugin's dial in a row. */
export type RowDial = {
    device: string;
    column: number;
    /** The dial's name in the row's map (e.g. a channel or player name). */
    label: () => string;
    /** The row and membership the dial has stored (see fromSettings). */
    state: () => RowDialState;
    /** Store into the dial's settings. */
    save: (patch: { panorama?: PanoramaRow; panoramaMember?: boolean }) => void;
    redraw: () => void;
    /** The effect to stay in a group with while the row has none (e.g. the blank effect, so text spans dials). */
    whenNone?: string;
};

/** One dial in the PI's map of the row. */
export type RowMapDial = { column: number; plugin: string; label: string; member: boolean; self: boolean };

/** Pushed to the PI ("panorama-row"). */
export type RowInfo = { event: 'panorama-row'; device: string; effect: string; settings: Record<string, unknown>; effects: EffectInfo[]; dials: RowMapDial[] };

/** The parts of the bus rows use. */
export type RowsBus = Pick<DeckBus, 'onPeers' | 'setState' | 'handle' | 'request'>;

/** The parts of the kit's PI bridge rows use. */
export type RowsPiBridge = {
    readonly visibleAction: string | undefined;
    handle(event: string, handler: (msg: Record<string, unknown> & { event: string }, actionId: string) => void | Promise<void>): void;
    addPusher(pusher: () => (Record<string, unknown> & { event: string })[]): void;
    schedulePush(): void;
};

const STATE_KEY = 'panorama-rows';

/**
 * A dial's stored state from its settings: `panorama` and `panoramaMember`, else the old
 * `background` setting (an effect id → the row's effect, older than any real choice; "none" or ""
 * → not in the Panorama; "auto" → in it). `unset` says what a dial without any of them is.
 */
export function rowStateFromSettings(settings: Record<string, unknown>, unset: 'member' | 'silent' = 'member'): RowDialState {
    const stored = settings.panorama as PanoramaRow | undefined;
    const bg = typeof settings.background === 'string' ? settings.background : undefined;
    // The checkbox once set; before that what the old setting meant
    const member = typeof settings.panoramaMember === 'boolean' ? settings.panoramaMember : bg === undefined ? unset === 'member' : bg !== '' && bg !== BACKGROUND_NONE;
    if (stored && typeof stored === 'object' && typeof stored.effect === 'string') return { row: { effect: stored.effect, settings: stored.settings ?? {}, stamp: Number(stored.stamp) || 0 }, member };
    if (bg === undefined || bg === '' || bg === BACKGROUND_NONE || bg === BACKGROUND_AUTO) return { member };
    // An old effect choice with its flat tuning fields
    const def = effectRegistry.get(bg);
    const tuned: Record<string, unknown> = {};
    for (const f of def?.settingsSchema ?? []) if (settings[f.key] !== undefined) tuned[f.key] = settings[f.key];
    return { row: { effect: def ? bg : DEFAULT_EFFECT_ID, settings: tuned, stamp: 1 }, member };
}

export class PanoramaRows {
    private readonly dials = new Map<string, RowDial>();
    private readonly rows = new Map<string, PanoramaRow>();
    private readonly applied = new Map<string, string>();
    private bus: RowsBus | undefined;
    private peers: PeerInfo[] = [];
    private pi: RowsPiBridge | undefined;
    private published = '';

    constructor(
        private readonly panorama: SharedPanorama,
        private readonly options: { name: string; actions?: Pick<ActionsState, 'update'>; defaultEffect?: string },
    ) {}

    /** Share rows with the other plugins (call once the bus exists). */
    connect(bus: RowsBus): void {
        this.bus = bus;
        bus.handle(
            'panorama-member',
            (params) => {
                const p = params as { device?: string; column?: number; member?: boolean };
                if (typeof p?.device === 'string' && typeof p.column === 'number' && typeof p.member === 'boolean') this.setOwnMember(p.device, p.column, p.member);
                return true;
            },
            () => true,
        );
        bus.onPeers((peers) => {
            this.peers = peers;
            this.refreshAll();
        });
        this.publish();
    }

    /** Serve the PI's Panorama section through the plugin's PI bridge. */
    attachPi(bridge: RowsPiBridge): void {
        this.pi = bridge;
        bridge.addPusher(() => {
            const ctx = bridge.visibleAction;
            return ctx && this.dials.has(ctx) ? [this.info(ctx) as unknown as Record<string, unknown> & { event: string }] : [];
        });
        bridge.handle('panorama-set', (msg, actionId) => {
            const d = this.dials.get(actionId);
            if (!d) return;
            this.setRow(d.device, { effect: typeof msg.effect === 'string' ? msg.effect : undefined, settings: (msg.settings as Record<string, unknown> | undefined) ?? undefined });
        });
        bridge.handle('panorama-member', (msg, actionId) => {
            const d = this.dials.get(actionId);
            if (d && typeof msg.column === 'number' && typeof msg.member === 'boolean') void this.setMember(d.device, msg.column, msg.member);
        });
    }

    add(context: string, dial: RowDial): void {
        this.dials.set(context, dial);
        this.refresh(dial.device);
    }

    remove(context: string): void {
        const d = this.dials.get(context);
        if (!d) return;
        this.dials.delete(context);
        this.applied.delete(context);
        this.panorama.leave(context);
        this.refresh(d.device);
    }

    /** The dial's settings changed (e.g. its PI): take up a newer row, a changed checkbox or position. */
    changed(context: string): void {
        const d = this.dials.get(context);
        if (d) this.refresh(d.device);
    }

    /** The row on a device (Particles until someone chooses). */
    rowOf(device: string): PanoramaRow {
        return this.rows.get(device) ?? { effect: this.options.defaultEffect ?? DEFAULT_EFFECT_ID, settings: {}, stamp: 0 };
    }

    /** Whether the dial shows the effect (unchecked dials are silent members). */
    isMember(context: string): boolean {
        return this.dials.get(context)?.state().member !== false;
    }

    /** The effect the dial's row runs (undefined: none). */
    effectOf(context: string): string | undefined {
        const d = this.dials.get(context);
        const effect = d ? this.rowOf(d.device).effect : undefined;
        return effect && effect !== ROW_NONE ? effect : undefined;
    }

    /** Choose the row's effect and/or change its settings (from a PI, or a dial that tunes it): the latest change. */
    setRow(device: string, patch: { effect?: string; settings?: Record<string, unknown> }): void {
        const cur = this.rowOf(device);
        const effect = patch.effect ?? cur.effect;
        // A new effect starts from its own defaults; the same one keeps its tuning
        const settings = effect !== cur.effect ? { ...(patch.settings ?? {}) } : { ...cur.settings, ...(patch.settings ?? {}) };
        this.rows.set(device, { effect, settings, stamp: Math.max(Date.now(), cur.stamp + 1) });
        this.refresh(device);
    }

    /** Check or uncheck a dial of the row: ours directly, another plugin's through the bus. */
    async setMember(device: string, column: number, member: boolean): Promise<void> {
        if (this.setOwnMember(device, column, member)) return;
        const owner = this.peers.find((p) => peerActions(p).some((a) => a.device === device && a.column === column && a.controller === 'Encoder'));
        if (owner && this.bus) await this.bus.request(owner, 'panorama-member', { device, column, member }).catch(() => undefined);
    }

    /** What the PI's Panorama section shows for this dial's row. */
    info(context: string): RowInfo {
        const d = this.dials.get(context)!;
        const row = this.rowOf(d.device);
        const dials: RowMapDial[] = [];
        for (const [ctx, o] of this.dials) {
            if (o.device !== d.device) continue;
            dials.push({ column: o.column, plugin: this.options.name, label: o.label(), member: o.state().member !== false, self: ctx === context });
        }
        for (const peer of this.peers) {
            for (const a of peerActions(peer) as (BusAction & { label?: string; panoramaMember?: boolean })[]) {
                if (a.device !== d.device || a.controller !== 'Encoder' || dials.some((x) => x.column === a.column)) continue;
                dials.push({ column: a.column, plugin: peer.name, label: typeof a.label === 'string' ? a.label : '', member: a.panoramaMember !== false, self: false });
            }
        }
        dials.sort((a, b) => a.column - b.column);
        return { event: 'panorama-row', device: d.device, effect: row.effect, settings: row.settings, effects: listEffects(), dials };
    }

    // ---- keeping the row in agreement ---------------------------------------------------------

    private setOwnMember(device: string, column: number, member: boolean): boolean {
        const own = [...this.dials.values()].find((o) => o.device === device && o.column === column);
        if (!own) return false;
        own.save({ panoramaMember: member });
        this.refresh(device);
        return true;
    }

    private refreshAll(): void {
        for (const device of new Set([...this.dials.values()].map((d) => d.device))) this.refresh(device);
    }

    /** The newest row on a device (ours, our dials', the peers'), stored with our dials and run. */
    private refresh(device: string): void {
        let row = this.rows.get(device);
        const own = [...this.dials.entries()].filter(([, d]) => d.device === device).sort((a, b) => a[1].column - b[1].column);
        // Left to right, so with equal stamps (old settings) the left dial wins
        for (const [, d] of own) row = newer(row, d.state().row);
        for (const peer of this.peers) row = newer(row, (peer.state[STATE_KEY] as Record<string, PanoramaRow> | undefined)?.[device]);
        row ??= this.rowOf(device);
        this.rows.set(device, row);
        for (const [ctx, d] of own) {
            const effect = row.effect !== ROW_NONE ? row.effect : d.whenNone;
            if (d.state().row?.stamp !== row.stamp || d.state().row?.effect !== row.effect) d.save({ panorama: row });
            const member = d.state().member !== false;
            this.options.actions?.update(ctx, { label: d.label(), panoramaMember: member } as Partial<BusAction>);
            const key = JSON.stringify([effect, d.column, row.settings, member]);
            if (this.applied.get(ctx) === key) continue;
            this.applied.set(ctx, key);
            if (effect) {
                this.panorama.join(ctx, device, d.column, effect, row.settings, d.redraw);
                this.panorama.updateSettings(ctx, row.settings);
            } else this.panorama.leave(ctx);
            d.redraw();
        }
        this.publish();
        this.pi?.schedulePush();
    }

    private publish(): void {
        if (!this.bus) return;
        const devices = new Set([...this.dials.values()].map((d) => d.device));
        const out: Record<string, PanoramaRow> = {};
        for (const device of devices) {
            const row = this.rows.get(device);
            if (row) out[device] = row;
        }
        const json = JSON.stringify(out);
        if (json === this.published) return;
        this.published = json;
        this.bus.setState(STATE_KEY, out);
    }
}

function newer(a: PanoramaRow | undefined, b: PanoramaRow | undefined): PanoramaRow | undefined {
    if (!b || typeof b.effect !== 'string') return a;
    if (!a) return b;
    return (Number(b.stamp) || 0) > a.stamp ? b : a;
}
