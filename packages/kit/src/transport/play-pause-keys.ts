// The universal Play/Pause key (grill 2026-10-09, notes/2026-10-09-universal-transport-keys-grill.md):
// the same key in every plugin. The plugin only provides players (PlayerBoard) and a thin action
// class with its UUID; this does the rest for all its Play/Pause keys: which player, what to show,
// and what a press sends. Kept SDK-free (the plugin passes `draw`).
//
// Lessons from Music Assistant on Sonos (2026-10-09) built in: a press sends an explicit play or
// pause by what the key shows (a toggle on a server that learns of a pause late paused twice), the
// new state shows at once until the device confirms it, and a paused key keeps its position.
import { mdiApplicationOutline, mdiMusicNote } from '@mdi/js';
import { getCachedCover, loadCover } from '../render/cover-cache.js';
import { CoverFader } from '../render/cover-fade.js';
import { frames } from '../render/frames.js';
import { KEY_TIERS } from '../render/key-style.js';
import { SONOS_TITLE_FADER, TitleFader } from '../render/title-fader.js';
import { KEY_GREY, resolveKeyColor } from '../players/key-color.js';
import { ACTIVE_PLAYER, positionNow, type Player, type PlayerBoard, type TransportCommand } from '../players/players.js';
import { batteryBadge, type BatteryMode, type CornerBadge, type CornerChoice } from './corners.js';
import { renderPlayPauseKey } from './play-pause-render.js';

/** A Play/Pause key's settings, the same in every plugin. */
export type PlayPauseKeySettings = {
    /** A player choice ("active", "active:all", "device:…", …); none: the plugin's default. */
    player?: string;
    /** Icon colour: "grey" (default), "cover", "row" or "#RRGGBB" (see resolveKeyColor). */
    keyColor?: string;
    topLeft?: CornerChoice;
    topRight?: CornerChoice;
    /** The marker's MDI icon name. */
    marker?: string;
    battery?: BatteryMode;
    showCover?: boolean;
    showTitle?: boolean;
    showProgress?: boolean;
    /** The player's name as the key's Stream Deck title. */
    showName?: boolean;
};

/** What a new key starts with (grill Q8c: marker left, source right). */
export const PLAY_PAUSE_DEFAULTS: Required<Pick<PlayPauseKeySettings, 'topLeft' | 'topRight' | 'battery' | 'showCover' | 'showTitle' | 'showProgress'>> = {
    topLeft: 'marker',
    topRight: 'source',
    battery: 'low',
    showCover: true,
    showTitle: false,
    showProgress: false,
};

/** How long the key shows a pressed state before the device has confirmed it. */
const HOLD_PLAY_MS = 8000;
const HOLD_PAUSE_MS = 40_000;
const MARKER_COLOR = '#b8b8be';

export type PlayPauseKeysOptions = {
    board: Pick<PlayerBoard, 'resolve' | 'send' | 'onChange'>;
    /** Shows a key's picture and title (the plugin calls action.setImage / setTitle; title "" clears it). */
    draw: (id: string, image: string, title: string) => void;
    /** The player of a key without one: "active" (speakers) by default; SA-C: "active:all". */
    defaultPlayer?: string;
    /** The Panorama row colour of a key's Stream Deck (for keyColor "row"). */
    rowColor?: (id: string) => string | undefined;
    /** MDI path of a marker name (the plugin's icon catalog). */
    markerPath?: (name: string) => string | undefined;
    now?: () => number;
};

type Key = {
    settings: PlayPauseKeySettings;
    fader?: TitleFader;
    /** A pressed state shown until the device confirms it. */
    pressed?: { playing: boolean; until: number; position?: number };
    last?: string;
    lastTitle?: string;
};

export class PlayPauseKeys {
    private readonly keys = new Map<string, Key>();
    private readonly covers = new CoverFader();
    private readonly off: () => void;
    private readonly timer: ReturnType<typeof setInterval>;
    private readonly now: () => number;

    constructor(private readonly o: PlayPauseKeysOptions) {
        this.now = o.now ?? Date.now;
        this.off = o.board.onChange(() => this.renderAll());
        // The progress moves on while playing; a pressed state runs out
        this.timer = setInterval(() => this.renderAll(), 1000);
        this.timer.unref?.();
    }

    /** A key appeared or its settings changed. */
    show(id: string, settings: PlayPauseKeySettings): void {
        const k = this.keys.get(id);
        if (k) k.settings = settings;
        else this.keys.set(id, { settings });
        if (k) k.last = k.lastTitle = undefined;
        this.render(id);
    }

    hide(id: string): void {
        this.keys.delete(id);
        this.covers.forget(id);
        frames.stop(`play-pause-title-${id}`);
    }

    /** The player a key controls now. */
    player(id: string): Player | undefined {
        const k = this.keys.get(id);
        return k ? this.o.board.resolve(k.settings.player || this.o.defaultPlayer || ACTIVE_PLAYER) : undefined;
    }

    /** Whether the key shows its player playing (a press not yet confirmed counts). */
    playing(id: string): boolean {
        const k = this.keys.get(id);
        const p = this.player(id);
        return !!k && !!p && this.shownPlaying(k, p);
    }

    /** Play or pause, by what the key shows. Rejects without a player or when the command fails. */
    async press(id: string): Promise<void> {
        const k = this.keys.get(id);
        const p = this.player(id);
        if (!k || !p) throw new Error('play/pause: no player');
        const play = !this.shownPlaying(k, p);
        const wanted: TransportCommand = play ? 'play' : 'pause';
        // An older peer may only know the toggle
        const command: TransportCommand = !p.can || p.can.includes(wanted) ? wanted : 'play-pause';
        k.pressed = { playing: play, until: this.now() + (play ? HOLD_PLAY_MS : HOLD_PAUSE_MS), position: play ? undefined : positionNow(p, this.now()) };
        this.render(id);
        try {
            await this.o.board.send(p, command);
        } catch (e) {
            k.pressed = undefined;
            this.render(id);
            throw e;
        }
    }

    dispose(): void {
        this.off();
        clearInterval(this.timer);
        for (const id of [...this.keys.keys()]) this.hide(id);
    }

    private renderAll(): void {
        for (const id of this.keys.keys()) this.render(id);
    }

    private shownPlaying(k: Key, p: Player): boolean {
        const pr = k.pressed;
        if (pr && (this.now() > pr.until || pr.playing === p.playing)) k.pressed = undefined;
        return k.pressed ? k.pressed.playing : p.playing;
    }

    private render(id: string): void {
        const k = this.keys.get(id);
        if (!k) return;
        const s = { ...PLAY_PAUSE_DEFAULTS, ...k.settings };
        const p = this.player(id);
        const image = p ? this.view(id, k, s, p) : renderPlayPauseKey({ unavailable: true, playing: false, iconColor: KEY_TIERS.unavailable, accent: KEY_GREY, left: this.marker(s, s.topLeft, true), right: this.marker(s, s.topRight, true) });
        if (!p) frames.stop(`play-pause-title-${id}`);
        const title = k.settings.showName && p ? p.name : '';
        if (image === k.last && title === k.lastTitle) return;
        k.last = image;
        k.lastTitle = title;
        this.o.draw(id, image, title);
    }

    private view(id: string, k: Key, s: PlayPauseKeySettings & typeof PLAY_PAUSE_DEFAULTS, p: Player): string {
        const playing = this.shownPlaying(k, p);
        const iconColor = resolveKeyColor(s.keyColor, { cover: p.color, row: this.o.rowColor?.(id) });
        // Grey keys show the cover's own colour in the bar and the paused symbol, as before
        const accent = !s.keyColor || s.keyColor === 'grey' ? (p.color ?? KEY_GREY) : iconColor;
        const cover = s.showCover && p.cover ? this.covers.frame(id, p.cover, () => this.render(id)) : undefined;
        if (!cover) this.covers.forget(id);

        let progress: number | undefined;
        if (s.showProgress && p.duration) {
            const pos = !playing && k.pressed ? k.pressed.position : positionNow({ ...p, playing }, this.now());
            if (pos !== undefined) progress = pos / p.duration;
        }

        return renderPlayPauseKey({
            playing,
            cover: cover?.cover,
            previousCover: cover?.previous,
            coverMix: cover?.mix,
            iconColor,
            accent,
            progress,
            titleSvg: this.title(id, k, s, p),
            left: this.corner(s, s.topLeft, p),
            right: this.corner(s, s.topRight, p),
        });
    }

    /** The scrolling "title [artist]" at the bottom, while the setting is on and something is named. */
    private title(id: string, k: Key, s: PlayPauseKeySettings, p: Player): string | undefined {
        const text = p.title ? `${p.title}${p.artist ? ` [${p.artist}]` : ''}` : (p.artist ?? '');
        if (!s.showTitle || !text) {
            k.fader = undefined;
            frames.stop(`play-pause-title-${id}`);
            return undefined;
        }
        if (!k.fader) k.fader = new TitleFader(text, SONOS_TITLE_FADER);
        else k.fader.setText(text);
        frames.run(`play-pause-title-${id}`, () => {
            const key = this.keys.get(id);
            if (!key?.fader) return false;
            if (key.fader.step()) this.render(id);
            return true;
        });
        return k.fader.svg();
    }

    private corner(s: PlayPauseKeySettings, choice: CornerChoice, p: Player): CornerBadge | undefined {
        switch (choice) {
            case 'marker':
                return this.marker(s, choice, false);
            case 'battery':
                return batteryBadge(p.battery, p.charging, s.battery);
            case 'source': {
                if (p.sourceIcon) {
                    // Stream Deck doesn't load URLs inside a key image: the picture goes in as data
                    const data = p.sourceIcon.startsWith('data:') ? p.sourceIcon : getCachedCover(p.sourceIcon);
                    if (data) return { kind: 'image', href: data };
                    void loadCover(p.sourceIcon).then((c) => c && this.renderAll());
                }
                return p.source ? { kind: 'icon', path: p.kind === 'app' ? mdiApplicationOutline : mdiMusicNote, color: '#e0e0e0' } : undefined;
            }
            default:
                return undefined;
        }
    }

    private marker(s: PlayPauseKeySettings, choice: CornerChoice, dim: boolean): CornerBadge | undefined {
        if (choice !== 'marker' || !s.marker) return undefined;
        const path = this.o.markerPath?.(s.marker);
        return path ? { kind: 'icon', path, color: dim ? KEY_TIERS.unavailable : MARKER_COLOR } : undefined;
    }
}
