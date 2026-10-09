// The universal Volume key as a Stream Deck action (grill 2026-10-09), as PlayPauseKeyAction: a
// plugin gives it its UUID and players.
import streamDeck, { SingletonAction, type DidReceiveSettingsEvent, type KeyAction, type KeyDownEvent, type KeyUpEvent, type WillAppearEvent, type WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { VolumeKeys, type VolumeKeySettings, type VolumeKeysOptions } from '../transport/volume-keys.js';

type Settings = VolumeKeySettings & JsonObject;

/** How long a press must be held to set the preset volume (on keys that have one). */
const LONG_PRESS_MS = 500;

export type VolumeKeyActionOptions<S extends Settings> = Omit<VolumeKeysOptions, 'draw' | 'rowColor'> & {
    rowColor?: (deviceId: string) => string | undefined;
    migrate?: (settings: S) => S | undefined;
    /** A picture and title instead of the dimmed key while no player is found (e.g. "set up"). */
    unavailable?: () => { image: string; title?: string } | undefined;
};

export class VolumeKeyAction<S extends Settings = Settings> extends SingletonAction<S> {
    private readonly shown = new Map<string, { action: KeyAction<S>; settings: S; image?: string; title?: string }>();
    protected readonly keys: VolumeKeys;
    private readonly holds = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly longDone = new Set<string>();

    constructor(private readonly options: VolumeKeyActionOptions<S>) {
        super();
        this.keys = new VolumeKeys({
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
        this.longDone.delete(ev.action.id);
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
        // A key with a preset on another command: a long press sets it, a short one acts on release
        if (!this.keys.hasLongPress(id)) return this.run(ev.action, () => this.keys.press(id));
        this.longDone.delete(id);
        clearTimeout(this.holds.get(id));
        this.holds.set(
            id,
            setTimeout(() => {
                this.holds.delete(id);
                this.longDone.add(id);
                void this.run(ev.action, () => this.keys.pressPreset(id));
            }, LONG_PRESS_MS),
        );
    }

    override async onKeyUp(ev: KeyUpEvent<S>): Promise<void> {
        const id = ev.action.id;
        const timer = this.holds.get(id);
        clearTimeout(timer);
        this.holds.delete(id);
        if (this.longDone.delete(id) || !timer) return;
        await this.run(ev.action, () => this.keys.press(id));
    }

    private async run(action: { showAlert(): Promise<void> }, fn: () => Promise<void>): Promise<void> {
        try {
            await fn();
        } catch (e) {
            streamDeck.logger.warn('[volume] press failed', e);
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
