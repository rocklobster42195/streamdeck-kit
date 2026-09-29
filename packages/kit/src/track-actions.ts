// Feeds deckbus' "actions" state from the Stream Deck SDK: every visible key and dial of this
// plugin (not those inside multi-actions), with optional extra fields such as the Panorama effect,
// refreshed when the action's settings change.
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import type { ActionsState, BusAction } from "./bus/actions.js";

/** Extra fields for an action from its UUID and settings (e.g. `{ effect: "boing-ball" }`). */
export type DescribeAction = (action: string, settings: JsonObject) => Partial<BusAction> | undefined;

/** Start tracking; returns a function that stops. Call before streamDeck.connect(). */
export function trackActions(state: ActionsState, describe?: DescribeAction): () => void {
    const kinds = new Map<string, string>();
    const subs = [
        streamDeck.actions.onWillAppear((ev) => {
            const payload = ev.payload as { controller?: string; coordinates?: { column: number; row: number }; isInMultiAction?: boolean };
            if (payload.isInMultiAction || !payload.coordinates) return;
            const uuid = ev.action.manifestId;
            kinds.set(ev.action.id, uuid);
            state.set(ev.action.id, {
                device: ev.action.device.id,
                column: payload.coordinates.column,
                row: payload.coordinates.row,
                controller: payload.controller === "Encoder" ? "Encoder" : "Keypad",
                action: uuid,
                ...describe?.(uuid, ev.payload.settings),
            });
        }),
        streamDeck.actions.onWillDisappear((ev) => {
            kinds.delete(ev.action.id);
            state.remove(ev.action.id);
        }),
        streamDeck.settings.onDidReceiveSettings((ev) => {
            const uuid = kinds.get(ev.action.id);
            if (uuid && describe) state.update(ev.action.id, emptyToUndefined(describe(uuid, ev.payload.settings)));
        }),
    ];
    return () => subs.forEach((s) => s.dispose());
}

/** A field the description no longer returns is removed (update() drops undefined values). */
function emptyToUndefined(patch: Partial<BusAction> | undefined): Partial<BusAction> {
    return { effect: undefined, ...patch };
}
