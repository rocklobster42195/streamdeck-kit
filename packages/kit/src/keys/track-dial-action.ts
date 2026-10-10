// The universal Track dial as a Stream Deck action (grill 2026-10-10), as VolumeDialAction: a plugin
// gives it its UUID and players. It draws into the dial's full-canvas pixmap. Panorama: the plugin
// puts the dial into its row on `onShown` and gives the slice behind it as `underlay`.
import streamDeck, {
    SingletonAction,
    type DialAction,
    type DialDownEvent,
    type DialRotateEvent,
    type DidReceiveSettingsEvent,
    type TouchTapEvent,
    type WillAppearEvent,
    type WillDisappearEvent,
} from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';
import { TrackDials, type TrackDialSettings, type TrackDialsOptions } from '../transport/track-dials.js';

type Settings = TrackDialSettings & JsonObject;

export type TrackDialActionOptions<S extends Settings> = Omit<TrackDialsOptions, 'draw' | 'rowColor'> & {
    rowColor?: (deviceId: string) => string | undefined;
    /** Older settings (SO-C: deviceIp, visualizerMode ...) as the dial's own; return undefined to leave them. */
    migrate?: (settings: S) => S | undefined;
    /** The dial appeared: join the row's Panorama, etc. */
    onShown?: (action: DialAction<S>, settings: S) => void;
    onHidden?: (id: string) => void;
    /** The dial's settings changed (the Panorama part follows them). */
    onSettings?: (action: DialAction<S>, settings: S) => void;
    /** A picture instead of the dimmed dial while no player is found (e.g. "set up"). */
    unavailable?: (settings: S) => string | undefined;
};

export class TrackDialAction<S extends Settings = Settings> extends SingletonAction<S> {
    private readonly shown = new Map<string, { action: DialAction<S>; settings: S; image?: string }>();
    protected readonly dials: TrackDials;

    constructor(private readonly options: TrackDialActionOptions<S>) {
        super();
        this.dials = new TrackDials({
            ...options,
            draw: (id, image) => this.draw(id, image),
            rowColor: (id) => {
                const s = this.shown.get(id);
                return s ? options.rowColor?.(s.action.device.id) : undefined;
            },
            onError: (e) => streamDeck.logger.warn('[track-dial] failed', e),
        });
    }

    /** Draw a dial again (e.g. its row's Panorama moved). */
    redraw(id: string): void {
        this.dials.redraw(id);
    }

    /** The ids of the dials on the deck. */
    ids(): string[] {
        return [...this.shown.keys()];
    }

    override onWillAppear(ev: WillAppearEvent<S>): void {
        if (!ev.action.isDial()) return;
        let settings = ev.payload.settings;
        const migrated = this.options.migrate?.(settings);
        if (migrated) {
            settings = migrated;
            void ev.action.setSettings(migrated);
        }
        this.shown.set(ev.action.id, { action: ev.action, settings });
        this.options.onShown?.(ev.action, settings);
        this.dials.show(ev.action.id, settings);
    }

    override onWillDisappear(ev: WillDisappearEvent<S>): void {
        this.shown.delete(ev.action.id);
        this.dials.hide(ev.action.id);
        this.options.onHidden?.(ev.action.id);
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): void {
        const s = this.shown.get(ev.action.id);
        if (!s || !ev.action.isDial()) return;
        s.settings = ev.payload.settings;
        this.options.onSettings?.(ev.action, s.settings);
        this.dials.show(ev.action.id, s.settings);
    }

    override onDialRotate(ev: DialRotateEvent<S>): void {
        this.dials.rotate(ev.action.id, ev.payload.ticks);
    }

    override async onDialDown(ev: DialDownEvent<S>): Promise<void> {
        await this.run(ev.action, () => this.dials.next(ev.action.id));
    }

    override async onTouchTap(ev: TouchTapEvent<S>): Promise<void> {
        await this.run(ev.action, () => this.dials.playPause(ev.action.id));
    }

    private async run(action: { showAlert(): Promise<void> }, fn: () => Promise<void>): Promise<void> {
        try {
            await fn();
        } catch (e) {
            streamDeck.logger.warn('[track-dial] failed', e);
            await action.showAlert();
        }
    }

    private draw(id: string, image: string): void {
        const s = this.shown.get(id);
        if (!s) return;
        if (!this.dials.player(id)) image = this.options.unavailable?.(s.settings) ?? image;
        if (image === s.image) return;
        s.image = image;
        void s.action.setFeedback({ 'full-canvas': image }).catch((e) => streamDeck.logger.warn('[track-dial] setFeedback failed', e));
    }
}
