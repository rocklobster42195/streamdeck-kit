// The universal Playback Control key as a Stream Deck action (grill 2026-10-09). Next/Previous act
// on release: holding them half a second switches seek mode on or off instead; every other command
// acts on press. A plugin gives it its UUID and players, as PlayPauseKeyAction.
import streamDeck, { SingletonAction, type DidReceiveSettingsEvent, type KeyAction, type KeyDownEvent, type KeyUpEvent, type WillAppearEvent, type WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { PlaybackKeys, type PlaybackKeySettings, type PlaybackKeysOptions } from '../transport/playback-keys.js';

type Settings = PlaybackKeySettings & JsonObject;

/** How long Next/Previous must be held to switch seek mode. */
const LONG_PRESS_MS = 500;

export type PlaybackControlKeyActionOptions<S extends Settings> = Omit<PlaybackKeysOptions, 'draw' | 'rowColor'> & {
    rowColor?: (deviceId: string) => string | undefined;
    migrate?: (settings: S) => S | undefined;
    /** A picture and title instead of the dimmed key while no player is found (e.g. "set up"). */
    unavailable?: () => { image: string; title?: string } | undefined;
};

export class PlaybackControlKeyAction<S extends Settings = Settings> extends SingletonAction<S> {
    private readonly shown = new Map<string, { action: KeyAction<S>; settings: S; image?: string; title?: string }>();
    private readonly holds = new Map<string, ReturnType<typeof setTimeout>>();
    /** Keys whose press already switched seek mode (their release does nothing more). */
    private readonly heldIntoSeek = new Set<string>();
    protected readonly keys: PlaybackKeys;

    constructor(private readonly options: PlaybackControlKeyActionOptions<S>) {
        super();
        this.keys = new PlaybackKeys({
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
        clearTimeout(this.holds.get(ev.action.id));
        this.holds.delete(ev.action.id);
        this.heldIntoSeek.delete(ev.action.id);
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
        const id = ev.action.id;
        if (!isSkip(ev.payload.settings.command)) return this.run(ev.action, id);
        // Next/Previous: a long press switches seek mode, a short one acts on release
        this.heldIntoSeek.delete(id);
        clearTimeout(this.holds.get(id));
        this.holds.set(
            id,
            setTimeout(() => {
                this.holds.delete(id);
                this.heldIntoSeek.add(id);
                if (!this.keys.toggleSeek(id)) void ev.action.showAlert();
            }, LONG_PRESS_MS),
        );
    }

    override async onKeyUp(ev: KeyUpEvent<S>): Promise<void> {
        const id = ev.action.id;
        if (!isSkip(ev.payload.settings.command)) return;
        const timer = this.holds.get(id);
        clearTimeout(timer);
        this.holds.delete(id);
        if (this.heldIntoSeek.delete(id) || !timer) return;
        await this.run(ev.action, id);
    }

    private async run(action: { showAlert(): Promise<void> }, id: string): Promise<void> {
        try {
            await this.keys.press(id);
        } catch (e) {
            streamDeck.logger.warn('[playback] press failed', e);
            await action.showAlert();
        }
    }

    private draw(id: string, image: string, title: string): void {
        const s = this.shown.get(id);
        if (!s) return;
        if (!this.keys.player(id)) {
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
    }
}

function isSkip(command: string | undefined): boolean {
    return command === undefined || command === 'next' || command === 'previous';
}
