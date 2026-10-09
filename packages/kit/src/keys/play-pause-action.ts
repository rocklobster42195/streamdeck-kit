// The universal Play/Pause key as a Stream Deck action (grill 2026-10-09): a plugin only gives it
// its UUID and players. `@action({ UUID: "…play-pause-key" }) class PlayPauseKey extends
// PlayPauseKeyAction { constructor() { super({ board: myPlayers }); } }`. The SDK part of the kit
// ("/keys"); what the key shows and sends is PlayPauseKeys (SDK-free).
import streamDeck, { SingletonAction, type DidReceiveSettingsEvent, type KeyAction, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import type { Player } from '../players/players.js';
import { PlayPauseKeys, type PlayPauseKeySettings, type PlayPauseKeysOptions } from '../transport/play-pause-keys.js';

type Settings = PlayPauseKeySettings & JsonObject;

export type PlayPauseKeyActionOptions<S extends Settings> = Omit<PlayPauseKeysOptions, 'draw' | 'rowColor'> & {
    /** The Panorama row colour of a Stream Deck (for keyColor "row"). */
    rowColor?: (deviceId: string) => string | undefined;
    /** The plugin's older settings onto these, once (undefined: nothing to do). */
    migrate?: (settings: S) => S | undefined;
    /** A picture and title instead of the dimmed key while no player is found (e.g. "set up"). */
    unavailable?: () => { image: string; title?: string } | undefined;
    /** Every drawn state, e.g. for the settings panel's header. */
    onDraw?: (id: string, state: { image: string; title: string; player: Player | undefined; playing: boolean }) => void;
};

export class PlayPauseKeyAction<S extends Settings = Settings> extends SingletonAction<S> {
    private readonly shown = new Map<string, { action: KeyAction<S>; settings: S; image?: string; title?: string }>();
    protected readonly keys: PlayPauseKeys;

    constructor(private readonly options: PlayPauseKeyActionOptions<S>) {
        super();
        this.keys = new PlayPauseKeys({
            ...options,
            draw: (id, image, title) => this.draw(id, image, title),
            rowColor: (id) => {
                const s = this.shown.get(id);
                return s ? options.rowColor?.(s.action.device.id) : undefined;
            },
        });
    }

    /** Draw the keys without a player again (e.g. the plugin's connection changed). */
    refresh(): void {
        for (const [id, s] of this.shown) if (!this.keys.player(id)) this.keys.show(id, s.settings);
    }

    override onWillAppear(ev: WillAppearEvent<S>): void {
        if (!ev.action.isKey()) return;
        let settings = ev.payload.settings;
        const migrated = this.options.migrate?.(settings);
        if (migrated) {
            settings = migrated;
            void ev.action.setSettings(migrated);
        }
        this.shown.set(ev.action.id, { action: ev.action, settings });
        this.keys.show(ev.action.id, settings);
    }

    override onWillDisappear(ev: WillDisappearEvent<S>): void {
        this.shown.delete(ev.action.id);
        this.keys.hide(ev.action.id);
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): void {
        const s = this.shown.get(ev.action.id);
        if (!s) return;
        s.settings = ev.payload.settings;
        this.keys.show(ev.action.id, s.settings);
    }

    override async onKeyDown(ev: KeyDownEvent<S>): Promise<void> {
        try {
            await this.keys.press(ev.action.id);
        } catch (e) {
            streamDeck.logger.warn('[play-pause] press failed', e);
            await ev.action.showAlert();
        }
    }

    private draw(id: string, image: string, title: string): void {
        const s = this.shown.get(id);
        if (!s) return;
        const player = this.keys.player(id);
        if (!player) {
            const instead = this.options.unavailable?.();
            if (instead) {
                image = instead.image;
                title = instead.title ?? '';
            }
        }
        if (image !== s.image) {
            s.image = image;
            void s.action.setImage(image);
        }
        if (title !== s.title) {
            s.title = title;
            void s.action.setTitle(title);
        }
        this.options.onDraw?.(id, { image, title, player, playing: !!player && this.keys.playing(id) });
    }
}
