// The universal Playback Control key (grill 2026-10-09; style "family" chosen by the user): one key
// per command — next, previous, shuffle, repeat, and where the player has them crossfade and
// "Don't stop the music" (autoplay). Next/Previous held switch to seek mode (SeekStepper). The
// same key in every plugin, on the PlayerBoard; kept SDK-free (the plugin passes `draw`).
import {
    mdiAllInclusive,
    mdiFastForward,
    mdiRepeat,
    mdiRepeatOff,
    mdiRepeatOnce,
    mdiRewind,
    mdiShuffleDisabled,
    mdiShuffleVariant,
    mdiSkipNext,
    mdiSkipPrevious,
    mdiTransition,
} from '@mdi/js';
import { KEY_ICON, KEY_TIERS, keyActiveFrame, keyActivePlate, keyCaption, keyIcon, keySvg } from '../render/key-style.js';
import { KEY_GREY, resolveKeyColor } from '../players/key-color.js';
import { ACTIVE_PLAYER, positionNow, type Player, type PlayerBoard, type RepeatMode, type TransportCommand } from '../players/players.js';
import { DEFAULT_SEEK_STEP, SeekStepper } from '../players/seek.js';

/** What a key does (the stored value; "dont_stop" is MA-C's older name for autoplay). */
export type PlaybackCommand = 'next' | 'previous' | 'shuffle' | 'repeat' | 'crossfade' | 'dont_stop';
export const PLAYBACK_COMMANDS: readonly PlaybackCommand[] = ['next', 'previous', 'shuffle', 'repeat', 'crossfade', 'dont_stop'];

export type PlaybackKeySettings = {
    player?: string;
    command?: PlaybackCommand;
    /** Seek mode: seconds per tap (the PI may store it as text). */
    seekStep?: number | string;
    keyColor?: string;
    /** MDI icon name, top right. */
    marker?: string;
};

const REPEAT_NEXT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
/** How long a flipped toggle shows before the player has to confirm it. */
const HOLD_TOGGLE_MS = 3000;

export type PlaybackKeysOptions = {
    board: Pick<PlayerBoard, 'resolve' | 'send' | 'onChange'>;
    /** Shows a key's picture and title. */
    draw: (id: string, image: string, title: string) => void;
    defaultPlayer?: string;
    rowColor?: (id: string) => string | undefined;
    markerPath?: (name: string) => string | undefined;
    /** The "on" colour of a grey key (MA-C: its blue); default the cover's colour, else light grey. */
    accent?: string;
    now?: () => number;
};

type Key = {
    settings: PlaybackKeySettings;
    seeker?: SeekStepper;
    /** A flipped toggle shown until the player confirms it. */
    pressed?: { value: boolean | RepeatMode; until: number };
    last?: string;
    lastTitle?: string;
    ticker?: ReturnType<typeof setInterval>;
};

/** The command a key sends (and what the player must offer in `can`). */
function transportOf(command: PlaybackCommand): TransportCommand {
    return command === 'dont_stop' ? 'autoplay' : command;
}

export class PlaybackKeys {
    private readonly keys = new Map<string, Key>();
    private readonly off: () => void;
    private readonly now: () => number;

    constructor(private readonly o: PlaybackKeysOptions) {
        this.now = o.now ?? Date.now;
        this.off = o.board.onChange(() => this.renderAll());
    }

    show(id: string, settings: PlaybackKeySettings): void {
        const k = this.keys.get(id);
        if (k) {
            k.settings = settings;
            k.last = k.lastTitle = undefined;
            if (!isSkip(settings.command)) k.seeker?.exit();
        } else this.keys.set(id, { settings });
        this.render(id);
    }

    hide(id: string): void {
        const k = this.keys.get(id);
        k?.seeker?.dispose();
        if (k?.ticker) clearInterval(k.ticker);
        this.keys.delete(id);
    }

    player(id: string): Player | undefined {
        const k = this.keys.get(id);
        return k ? this.o.board.resolve(k.settings.player || this.o.defaultPlayer || ACTIVE_PLAYER) : undefined;
    }

    /** Whether a Next/Previous key is in seek mode. */
    seeking(id: string): boolean {
        return !!this.keys.get(id)?.seeker?.active;
    }

    /** A long press on Next/Previous: seek mode on or off; false when there's nothing to seek in. */
    toggleSeek(id: string): boolean {
        const k = this.keys.get(id);
        if (!k || !isSkip(k.settings.command)) return false;
        const seeker = this.seekerOf(id, k);
        if (seeker.active) {
            seeker.exit();
            return true;
        }
        return seeker.enter();
    }

    /** A short press: the command, or one step while seeking. Rejects when the player can't. */
    async press(id: string): Promise<void> {
        const k = this.keys.get(id);
        const p = this.player(id);
        if (!k || !p) throw new Error('playback: no player');
        const command = k.settings.command ?? 'next';
        if (k.seeker?.active && isSkip(command)) {
            const n = Number(k.settings.seekStep);
            k.seeker.tap((command === 'next' ? 1 : -1) * (n > 0 ? n : DEFAULT_SEEK_STEP));
            return;
        }
        const transport = transportOf(command);
        if (p.can && !p.can.includes(transport)) throw new Error(`playback: ${p.name} can't ${transport}`);
        if (isSkip(command)) return void (await this.o.board.send(p, transport));
        const value = command === 'repeat' ? REPEAT_NEXT[this.repeatOf(k, p)] : !this.flagOf(k, p, command);
        k.pressed = { value, until: this.now() + HOLD_TOGGLE_MS };
        this.render(id);
        try {
            await this.o.board.send(p, transport, value);
        } catch (e) {
            k.pressed = undefined;
            this.render(id);
            throw e;
        }
    }

    dispose(): void {
        this.off();
        for (const id of [...this.keys.keys()]) this.hide(id);
    }

    private renderAll(): void {
        for (const id of this.keys.keys()) this.render(id);
    }

    private seekerOf(id: string, k: Key): SeekStepper {
        if (k.seeker) return k.seeker;
        k.seeker = new SeekStepper({
            position: () => {
                const p = this.player(id);
                return p ? positionNow(p, this.now()) : undefined;
            },
            duration: () => this.player(id)?.duration,
            seek: (target) => {
                const p = this.player(id);
                if (p) void this.o.board.send(p, 'seek', target).catch(() => {});
            },
            onChange: () => {
                const key = this.keys.get(id);
                if (!key) return;
                // While seeking, where the track is moves on every second
                if (key.ticker) clearInterval(key.ticker);
                key.ticker = key.seeker?.active ? setInterval(() => this.render(id), 1000) : undefined;
                this.render(id);
            },
        });
        return k.seeker;
    }

    /** A flag the key shows: the pressed one until the player agrees or it ran out. */
    private flagOf(k: Key, p: Player, command: PlaybackCommand): boolean {
        const actual = command === 'shuffle' ? !!p.shuffle : command === 'crossfade' ? !!p.crossfade : !!p.autoplay;
        return this.held(k, actual) as boolean;
    }

    private repeatOf(k: Key, p: Player): RepeatMode {
        return this.held(k, p.repeat ?? 'off') as RepeatMode;
    }

    private held(k: Key, actual: boolean | RepeatMode): boolean | RepeatMode {
        const pr = k.pressed;
        if (pr && (this.now() > pr.until || pr.value === actual)) k.pressed = undefined;
        return k.pressed ? k.pressed.value : actual;
    }

    private render(id: string): void {
        const k = this.keys.get(id);
        if (!k) return;
        const p = this.player(id);
        const command = k.settings.command ?? 'next';
        const marker = k.settings.marker ? this.o.markerPath?.(k.settings.marker) : undefined;
        const color = p ? resolveKeyColor(k.settings.keyColor, { cover: p.color, row: this.o.rowColor?.(id) }) : KEY_GREY;
        const grey = !k.settings.keyColor || k.settings.keyColor === 'grey';
        const on = grey ? (this.o.accent ?? p?.color ?? KEY_TIERS.available) : color;
        const can = !!p && (!p.can || p.can.includes(transportOf(command)));
        let view: PlaybackView;
        const title = '';
        if (k.seeker?.active && p) {
            const offset = k.seeker.offset;
            view = { icon: command === 'next' ? mdiFastForward : mdiRewind, color: on, caption: offset ? `${offset > 0 ? '+' : '−'}${clock(Math.abs(offset))}` : clock(positionNow(p, this.now()) ?? 0) };
        } else if (!p || !can) {
            view = { icon: iconOf(command, false, 'off'), color: KEY_TIERS.unavailable };
        } else if (isSkip(command)) {
            view = { icon: iconOf(command, false, 'off'), color: grey ? KEY_TIERS.available : color };
        } else {
            const repeat = command === 'repeat' ? this.repeatOf(k, p) : 'off';
            const active = command === 'repeat' ? repeat !== 'off' : this.flagOf(k, p, command);
            view = { icon: iconOf(command, active, repeat), color: active ? on : KEY_TIERS.off, active: active ? on : undefined };
        }
        const image = renderPlaybackKey({ ...view, marker });
        if (image === k.last && title === k.lastTitle) return;
        k.last = image;
        k.lastTitle = title;
        this.o.draw(id, image, title);
    }
}

export type PlaybackView = {
    icon: string;
    color: string;
    /** "On": a tinted plate and a frame in this colour. */
    active?: string;
    /** A line under the icon (seek mode). */
    caption?: string;
    /** The marker's MDI path, top right. */
    marker?: string;
};

/** The key in the family style (MA-C's, the kit's key-style): the icon, "on" with plate and frame. */
export function renderPlaybackKey(v: PlaybackView): string {
    const parts: string[] = [];
    if (v.active) parts.push(keyActivePlate(v.active));
    parts.push(keyIcon(v.icon, v.caption ? KEY_ICON.withCaption : v.marker ? { size: 100, x: 22, y: 22 } : KEY_ICON.full, v.color));
    if (v.caption) parts.push(keyCaption(v.caption, '#ffffff'));
    if (v.marker) parts.push(keyIcon(v.marker, { size: 22, x: 144 - 35, y: 13 }, '#b8b8be'));
    if (v.active) parts.push(keyActiveFrame(v.active));
    return keySvg(parts);
}

function iconOf(command: PlaybackCommand, active: boolean, repeat: RepeatMode): string {
    switch (command) {
        case 'next':
            return mdiSkipNext;
        case 'previous':
            return mdiSkipPrevious;
        case 'shuffle':
            return active ? mdiShuffleVariant : mdiShuffleDisabled;
        case 'repeat':
            return repeat === 'one' ? mdiRepeatOnce : repeat === 'all' ? mdiRepeat : mdiRepeatOff;
        case 'crossfade':
            return mdiTransition;
        case 'dont_stop':
            return mdiAllInclusive;
    }
}

function isSkip(command: PlaybackCommand | undefined): boolean {
    return command === undefined || command === 'next' || command === 'previous';
}

function clock(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
