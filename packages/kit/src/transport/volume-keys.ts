// The universal Volume key (grill 2026-10-09; family style as the Playback Control key): louder,
// quieter, mute and a preset volume, for any player on the deck. Up/down show the volume under the
// icon; mute shows it as a ring, pie or open ring (the user's choice), grey with a red speaker while
// muted; a preset is "on" while the volume is at it. The same key in every plugin; SDK-free.
import { mdiVolumeHigh, mdiVolumeLow, mdiVolumeMedium, mdiVolumeMinus, mdiVolumeOff, mdiVolumePlus } from '@mdi/js';
import { arc } from '../render/gauge/arc.js';
import { openRing } from '../render/gauge/open-ring.js';
import { pie } from '../render/gauge/pie.js';
import { KEY_ICON, KEY_TIERS, keyActiveFrame, keyActivePlate, keyCaption, keyIcon, keySvg } from '../render/key-style.js';
import { KEY_GREY, resolveKeyColor } from '../players/key-color.js';
import { keyStatusBadge, type StatusKind } from '../render/status-badge.js';
import { ACTIVE_PLAYER, type Player, type PlayerBoard } from '../players/players.js';

export type VolumeCommand = 'up' | 'down' | 'mute' | 'preset';
export type VolumeGauge = 'ring' | 'pie' | 'open';

export type VolumeKeySettings = {
    player?: string;
    command?: VolumeCommand;
    /** Percent per press for up/down (default 5). */
    step?: number | string;
    /** Target volume for "preset" (default 20); on the other commands, what a long press sets (none: no long press). */
    preset?: number | string;
    /** Show the volume on the key (default on). */
    showVolume?: boolean;
    /** The mute key's look (default ring). */
    gauge?: VolumeGauge;
    keyColor?: string;
    /** MDI icon name, top right. */
    marker?: string;
};

const MUTED = '#ff8a8a';
const MUTED_RING = '#5a5a60';
/** How long a pressed volume or mute shows before the player has to confirm it. */
const HOLD_MS = 3000;

export type VolumeKeysOptions = {
    board: Pick<PlayerBoard, 'resolve' | 'send' | 'onChange'> & Partial<Pick<PlayerBoard, 'status'>>;
    draw: (id: string, image: string, title: string) => void;
    defaultPlayer?: string;
    rowColor?: (id: string) => string | undefined;
    markerPath?: (name: string) => string | undefined;
    /** The colour of a grey key's gauge and "on" (MA-C: its blue); default light grey. */
    accent?: string;
    now?: () => number;
};

type Key = {
    settings: VolumeKeySettings;
    pressed?: { volume?: number; muted?: boolean; until: number };
    last?: string;
};

export class VolumeKeys {
    private readonly keys = new Map<string, Key>();
    private readonly off: () => void;
    private readonly now: () => number;

    constructor(private readonly o: VolumeKeysOptions) {
        this.now = o.now ?? Date.now;
        this.off = o.board.onChange(() => this.renderAll());
    }

    show(id: string, settings: VolumeKeySettings): void {
        const k = this.keys.get(id);
        if (k) {
            k.settings = settings;
            k.last = undefined;
        } else this.keys.set(id, { settings });
        this.render(id);
    }

    hide(id: string): void {
        this.keys.delete(id);
    }

    player(id: string): Player | undefined {
        const k = this.keys.get(id);
        return k ? this.o.board.resolve(k.settings.player || this.o.defaultPlayer || ACTIVE_PLAYER) : undefined;
    }

    /** Whether a long press does something (sets the preset volume): a preset on another command. */
    hasLongPress(id: string): boolean {
        const s = this.keys.get(id)?.settings;
        return !!s && s.command !== 'preset' && s.preset !== undefined && s.preset !== '';
    }

    /** A long press: the preset volume, unmuted (sonos-controller's keys did this). */
    async pressPreset(id: string): Promise<void> {
        return this.press(id, 'preset');
    }

    async press(id: string, as?: VolumeCommand): Promise<void> {
        const k = this.keys.get(id);
        const p = this.player(id);
        if (!k || !p) throw new Error('volume: no player');
        const can = (c: string) => !p.can || p.can.includes(c as never);
        const { volume, muted } = this.shown(k, p);
        const command = as ?? k.settings.command ?? 'up';
        const sends: (() => Promise<unknown>)[] = [];
        if (command === 'mute') {
            if (!can('mute')) throw new Error(`volume: ${p.name} can't mute`);
            k.pressed = { muted: !muted, until: this.now() + HOLD_MS };
            sends.push(() => this.o.board.send(p, 'mute', !muted));
        } else {
            const target = command === 'preset' ? presetOf(k.settings) : clamp(volume + (command === 'down' ? -1 : 1) * stepOf(k.settings));
            if (!can('volume') && !can('volume-by')) throw new Error(`volume: ${p.name} has no volume`);
            k.pressed = { volume: target, muted: command === 'preset' ? false : muted, until: this.now() + HOLD_MS };
            if (command === 'preset' && muted) sends.push(() => this.o.board.send(p, 'mute', false));
            sends.push(() => (can('volume') ? this.o.board.send(p, 'volume', target) : this.o.board.send(p, 'volume-by', target - volume)));
        }
        this.render(id);
        try {
            for (const send of sends) await send();
        } catch (e) {
            k.pressed = undefined;
            this.render(id);
            throw e;
        }
    }

    dispose(): void {
        this.off();
        this.keys.clear();
    }

    /** Draw a key again (e.g. its own speaker's volume moved, which the board doesn't report). */
    redraw(id: string): void {
        this.render(id);
    }

    private renderAll(): void {
        for (const id of this.keys.keys()) this.render(id);
    }

    /** Volume and mute as the key shows them: the pressed ones until the player agrees or they ran out. */
    private shown(k: Key, p: Player): { volume: number; muted: boolean } {
        const actual = { volume: Math.round(p.volume ?? 0), muted: !!p.muted };
        const pr = k.pressed;
        if (pr && (this.now() > pr.until || ((pr.volume === undefined || pr.volume === actual.volume) && (pr.muted === undefined || pr.muted === actual.muted)))) k.pressed = undefined;
        return { volume: k.pressed?.volume ?? actual.volume, muted: k.pressed?.muted ?? actual.muted };
    }

    private render(id: string): void {
        const k = this.keys.get(id);
        if (!k) return;
        const p = this.player(id);
        const s = k.settings;
        const marker = s.marker ? this.o.markerPath?.(s.marker) : undefined;
        const grey = !s.keyColor || s.keyColor === 'grey';
        const color = p && !grey ? resolveKeyColor(s.keyColor, { cover: p.color, row: this.o.rowColor?.(id) }) : (this.o.accent ?? KEY_TIERS.available);
        const usable = !!p && (!p.can || p.can.some((c) => c === 'volume' || c === 'volume-by' || c === 'mute')) && p.volume !== undefined;
        const view: VolumeView = usable
            ? { command: s.command ?? 'up', ...this.shown(k, p!), preset: presetOf(s), showVolume: s.showVolume !== false, gauge: s.gauge ?? 'ring', color, marker }
            : { command: s.command ?? 'up', volume: 0, muted: false, preset: presetOf(s), showVolume: false, gauge: s.gauge ?? 'ring', color: KEY_GREY, marker, unavailable: true };
        const image = renderVolumeKey({ ...view, status: p ? this.o.board.status?.(p) : undefined });
        if (image === k.last) return;
        k.last = image;
        this.o.draw(id, image, '');
    }
}

export type VolumeView = {
    /** What the player is doing about a command (a corner badge). */
    status?: StatusKind;
    command: VolumeCommand;
    volume: number;
    muted: boolean;
    preset: number;
    showVolume: boolean;
    gauge: VolumeGauge;
    /** The gauge's and "on" colour. */
    color: string;
    marker?: string;
    /** No player, or none with a volume: dimmed. */
    unavailable?: boolean;
};

/** The key in the family style (the kit's key-style), like the Playback Control key. */
export function renderVolumeKey(v: VolumeView): string {
    const parts: string[] = [];
    const icon = (path: string, color: string, caption?: string) => {
        parts.push(keyIcon(path, caption ? KEY_ICON.withCaption : KEY_ICON.full, color));
        if (caption) parts.push(keyCaption(caption, color === KEY_TIERS.unavailable ? color : '#ffffff'));
    };
    if (v.unavailable) {
        icon(v.command === 'down' ? mdiVolumeMinus : v.command === 'up' ? mdiVolumePlus : v.command === 'mute' ? mdiVolumeOff : volumeIcon(v.preset), KEY_TIERS.unavailable);
    } else if (v.command === 'up' || v.command === 'down') {
        icon(v.command === 'up' ? mdiVolumePlus : mdiVolumeMinus, v.muted ? KEY_TIERS.off : KEY_TIERS.available, v.showVolume && !v.muted ? String(v.volume) : undefined);
    } else if (v.command === 'preset') {
        const on = !v.muted && v.volume === v.preset;
        if (on) parts.push(keyActivePlate(v.color));
        icon(volumeIcon(v.preset), on ? v.color : KEY_TIERS.available, String(v.preset));
        if (on) parts.push(keyActiveFrame(v.color));
    } else {
        // Mute: the volume as a gauge; muted grey (at the volume that comes back) with a red speaker
        const value = v.volume / 100;
        const color = v.muted ? MUTED_RING : v.color;
        if (v.gauge === 'pie') parts.push(...pie(72, 72, 54, value, color));
        else if (v.gauge === 'open') parts.push(...openRing({ cx: 72, cy: 76, r: 52, width: 12, min: 0, max: 100, value: v.volume, zones: [{ from: -Infinity, color }] }));
        else parts.push(...arc(72, 72, 54, value, color, { width: 14 }));
        if (v.muted) parts.push(keyIcon(mdiVolumeOff, { size: 56, x: 44, y: 44 }, MUTED));
        else if (v.showVolume && v.gauge !== 'pie') parts.push(`<text x="72" y="${v.gauge === 'open' ? 91 : 87}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700" fill="#e0e0e0">${v.volume}</text>`);
        else if (v.gauge !== 'pie') parts.push(keyIcon(volumeIcon(v.volume), { size: 56, x: 44, y: 44 }, '#e0e0e0'));
    }
    if (v.marker) parts.push(keyIcon(v.marker, { size: 22, x: 144 - 35, y: 13 }, '#b8b8be'));
    if (v.status) parts.push(keyStatusBadge(v.status));
    return keySvg(parts);
}

/** The speaker icon for a volume (off, low, medium, high). */
export function volumeIcon(volume: number): string {
    if (volume <= 0) return mdiVolumeOff;
    if (volume < 34) return mdiVolumeLow;
    if (volume < 67) return mdiVolumeMedium;
    return mdiVolumeHigh;
}

function clamp(v: number): number {
    return Math.round(Math.min(100, Math.max(0, v)));
}

function stepOf(s: VolumeKeySettings): number {
    const n = Number(s.step);
    return n > 0 ? Math.min(25, n) : 5;
}

function presetOf(s: VolumeKeySettings): number {
    const n = Number(s.preset);
    return Number.isFinite(n) && s.preset !== undefined && s.preset !== '' ? clamp(n) : 20;
}
