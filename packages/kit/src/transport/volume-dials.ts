// The universal Volume dial (grill 2026-10-09): rotate sets the volume of any player on the deck,
// push mutes, a tap recalls the preset, a long tap saves the current volume as the preset. Shows
// what was turned at once until the player confirms (or HOLD_MS ran out); only the latest value is
// sent, a few times a second. The look is Sonos Controller's (render/volume-dial.ts). SDK-free.
import { glide } from '../render/glide.js';
import { renderVolumeDial, type VolumeDialGauge } from '../render/volume-dial.js';
import { ACTIVE_PLAYER, type Player, type PlayerBoard } from '../players/players.js';
import { KEY_GREY, resolveKeyColor } from '../players/key-color.js';
import { LatestSender } from '../util/latest-sender.js';

export type VolumeDialSettings = {
    player?: string;
    /** Percent per tick (default: the plugin's own; a fast spin doubles it). */
    step?: number | string;
    /** The volume a tap recalls (default 20); a long tap saves the current one. */
    preset?: number | string;
    gauge?: VolumeDialGauge;
    align?: 'left' | 'center' | 'right';
    showText?: boolean;
    /** MDI icon name: in the ring, or in the opening of the open ring. */
    icon?: string;
    keyColor?: string;
    /** The dial's own name instead of the player's. */
    title?: string;
};

/** How long a turned value shows before the player has to confirm it. */
const HOLD_MS = 3000;
/** How long the check after saving a preset shows. */
export const SAVED_MS = 1200;

export type VolumeDialsOptions = {
    board: Pick<PlayerBoard, 'resolve' | 'send' | 'onChange'>;
    /** Draws a dial; `underlay` is the row's Panorama slice, if the dial takes part. */
    draw: (id: string, image: string) => void;
    defaultPlayer?: string;
    /** Percent per tick when the dial has no setting. */
    defaultStep?: number;
    rowColor?: (id: string) => string | undefined;
    iconPath?: (name: string) => string | undefined;
    /** The Panorama slice behind a dial (an SVG fragment), or nothing. */
    underlay?: (id: string) => string | undefined;
    /** The word for a muted player, in the user's language. */
    mutedLabel: () => string;
    /** The name when no player is found. */
    noPlayerLabel: () => string;
    /** A long tap saved a preset: the plugin stores it in the dial's settings. */
    savePreset?: (id: string, volume: number) => void;
    onError?: (e: unknown) => void;
    now?: () => number;
};

type Dial = {
    settings: VolumeDialSettings;
    pressed?: { volume?: number; muted?: boolean; until: number };
    sender?: LatestSender<number>;
    /** The volume the player was last told, for a player that only takes steps. */
    told?: number;
    savedUntil?: number;
    last?: string;
};

export class VolumeDials {
    private readonly dials = new Map<string, Dial>();
    private readonly off: () => void;
    private readonly now: () => number;

    constructor(private readonly o: VolumeDialsOptions) {
        this.now = o.now ?? Date.now;
        this.off = o.board.onChange(() => this.renderAll());
    }

    show(id: string, settings: VolumeDialSettings): void {
        const d = this.dials.get(id);
        if (d) {
            d.settings = settings;
            d.last = undefined;
        } else this.dials.set(id, { settings });
        this.render(id);
    }

    hide(id: string): void {
        this.dials.delete(id);
    }

    /** Draw again (the Panorama behind it moved). */
    redraw(id: string): void {
        this.render(id);
    }

    player(id: string): Player | undefined {
        const d = this.dials.get(id);
        return d ? this.o.board.resolve(d.settings.player || this.o.defaultPlayer || ACTIVE_PLAYER) : undefined;
    }

    /** Rotate: `ticks` detents (a fast spin arrives as a few big ones). */
    rotate(id: string, ticks: number): void {
        const d = this.dials.get(id);
        const p = this.player(id);
        if (!d || !p || !this.hasVolume(p)) return;
        const fast = Math.abs(ticks) > 3;
        const step = stepOf(d.settings, this.o.defaultStep);
        const { volume, muted } = this.shown(d, p);
        const target = clamp(volume + ticks * step * (fast ? 2 : 1));
        if (target === volume && !muted) return;
        d.pressed = { volume: target, muted: false, until: this.now() + HOLD_MS };
        this.render(id);
        // Turning an muted player up or down unmutes it first (as the Sonos dial did)
        if (muted) void this.o.board.send(p, 'mute', false).catch((e) => this.o.onError?.(e));
        this.sender(id, d).push(target);
    }

    /** Push: mute or unmute. */
    async mute(id: string): Promise<void> {
        const d = this.dials.get(id);
        const p = this.player(id);
        if (!d || !p) throw new Error('volume: no player');
        if (p.can && !p.can.includes('mute')) throw new Error(`volume: ${p.name} can't mute`);
        const { muted } = this.shown(d, p);
        d.pressed = { ...d.pressed, muted: !muted, until: this.now() + HOLD_MS };
        this.render(id);
        try {
            await this.o.board.send(p, 'mute', !muted);
        } catch (e) {
            d.pressed = undefined;
            this.render(id);
            throw e;
        }
    }

    /** A tap: the preset volume, unmuted. */
    async recall(id: string): Promise<void> {
        const d = this.dials.get(id);
        const p = this.player(id);
        if (!d || !p || !this.hasVolume(p)) throw new Error('volume: no player');
        const { muted } = this.shown(d, p);
        const target = presetOf(d.settings);
        d.pressed = { volume: target, muted: false, until: this.now() + HOLD_MS };
        this.render(id);
        try {
            if (muted) await this.o.board.send(p, 'mute', false);
            await this.send(id, d, p, target);
        } catch (e) {
            d.pressed = undefined;
            this.render(id);
            throw e;
        }
    }

    /** A long tap: the current volume becomes the preset. */
    savePreset(id: string): void {
        const d = this.dials.get(id);
        const p = this.player(id);
        if (!d || !p || !this.hasVolume(p)) return;
        const { volume } = this.shown(d, p);
        d.settings = { ...d.settings, preset: volume };
        d.savedUntil = this.now() + SAVED_MS;
        this.o.savePreset?.(id, volume);
        this.render(id);
        setTimeout(() => this.render(id), SAVED_MS + 50);
    }

    dispose(): void {
        this.off();
        this.dials.clear();
    }

    private hasVolume(p: Player): boolean {
        return p.volume !== undefined && (!p.can || p.can.includes('volume') || p.can.includes('volume-by'));
    }

    private sender(id: string, d: Dial): LatestSender<number> {
        if (!d.sender) {
            d.sender = new LatestSender<number>(
                (v) => {
                    const p = this.player(id);
                    if (!p) return Promise.resolve();
                    return this.send(id, d, p, v);
                },
                150,
                (e) => this.o.onError?.(e),
            );
        }
        return d.sender;
    }

    private send(id: string, d: Dial, p: Player, target: number): Promise<unknown> {
        const can = (c: string) => !p.can || p.can.includes(c as never);
        if (can('volume')) return this.o.board.send(p, 'volume', target);
        // A player that only takes steps: from what it was last told (or reported)
        const from = d.told ?? Math.round(p.volume ?? 0);
        d.told = target;
        return this.o.board.send(p, 'volume-by', target - from);
    }

    /** Volume and mute as shown: the turned ones until the player agrees or they ran out. */
    private shown(d: Dial, p: Player): { volume: number; muted: boolean } {
        const actual = { volume: Math.round(p.volume ?? 0), muted: !!p.muted };
        const pr = d.pressed;
        if (pr && (this.now() > pr.until || ((pr.volume === undefined || pr.volume === actual.volume) && (pr.muted === undefined || pr.muted === actual.muted)))) {
            d.pressed = undefined;
            d.told = undefined;
        }
        return { volume: d.pressed?.volume ?? actual.volume, muted: d.pressed?.muted ?? actual.muted };
    }

    private renderAll(): void {
        for (const id of this.dials.keys()) this.render(id);
    }

    private render(id: string): void {
        const d = this.dials.get(id);
        if (!d) return;
        const p = this.player(id);
        const s = d.settings;
        const usable = !!p && this.hasVolume(p);
        const shown = usable ? this.shown(d, p!) : { volume: 0, muted: false };
        const grey = !s.keyColor || s.keyColor === 'grey';
        const color = usable && !grey ? resolveKeyColor(s.keyColor, { cover: p!.color, row: this.o.rowColor?.(id) }) : KEY_GREY;
        // The ring glides to a new volume; the number shows the target at once
        const ring = usable ? glide(`volume-dial-${id}`, shown.volume, () => this.render(id)) : 0;
        const image = renderVolumeDial({
            name: s.title?.trim() || (p ? p.name : this.o.noPlayerLabel()),
            volume: shown.volume,
            gaugeVolume: ring,
            muted: shown.muted,
            gauge: s.gauge,
            align: s.align,
            showText: s.showText,
            color,
            icon: s.icon ? this.o.iconPath?.(s.icon) : undefined,
            unavailable: !usable,
            mutedLabel: this.o.mutedLabel(),
            saved: (d.savedUntil ?? 0) > this.now(),
            underlay: this.o.underlay?.(id),
        });
        if (image === d.last) return;
        d.last = image;
        this.o.draw(id, image);
    }
}

function clamp(v: number): number {
    return Math.round(Math.min(100, Math.max(0, v)));
}

function stepOf(s: VolumeDialSettings, fallback = 1): number {
    const n = Number(s.step);
    return s.step === undefined || s.step === '' || !Number.isFinite(n) ? fallback : Math.min(10, Math.max(1, Math.round(n)));
}

function presetOf(s: VolumeDialSettings): number {
    const n = Number(s.preset);
    return s.preset === undefined || s.preset === '' || !Number.isFinite(n) ? 20 : clamp(n);
}
