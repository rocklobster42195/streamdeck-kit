// A dial's "background" setting, the same in every plugin: unset or "auto" takes the effect of the
// dial next to it (left first, then right), from another plugin (deckbus "actions") or the same
// plugin, so a row of dials joins one Panorama; "none" shows no effect; anything else is an effect
// id. Plugins resolve their dials with resolveBackgrounds() and offer backgroundOptions() in the PI.
import { neighbours, type BusAction } from "../bus/actions.js";
import type { PeerInfo } from "../bus/bus.js";
import { listEffects } from "./registry.js";

export const BACKGROUND_AUTO = "auto";
export const BACKGROUND_NONE = "none";

/** Where a dial sits and what its "background" setting says. */
export type BackgroundDial = { context: string; device: string; column: number; background: string | undefined };

/**
 * The effect each dial shows (undefined: none). "Auto" dials take a neighbour's: other plugins'
 * dials from `peers`, and the plugin's own dials once they have one (repeated, so it spreads
 * along a row: three faders next to an MA-C dial all join its Panorama).
 */
export function resolveBackgrounds(dials: BackgroundDial[], peers: PeerInfo[]): Map<string, string | undefined> {
    const out = new Map<string, string | undefined>();
    for (const d of dials) {
        const bg = d.background?.trim();
        if (bg && bg !== BACKGROUND_AUTO) out.set(d.context, bg === BACKGROUND_NONE ? undefined : bg);
    }
    const auto = dials.filter((d) => !out.has(d.context)).sort((a, b) => a.column - b.column);
    for (let changed = true; changed; ) {
        changed = false;
        for (const d of auto) {
            if (out.get(d.context) !== undefined) continue;
            const effect = neighbourEffect(d, -1, dials, out, peers) ?? neighbourEffect(d, 1, dials, out, peers);
            if (effect) {
                out.set(d.context, effect);
                changed = true;
            }
        }
    }
    for (const d of auto) if (!out.has(d.context)) out.set(d.context, undefined);
    return out;
}

/** The effect of the dial on one side (`side` -1 left, 1 right): another plugin's or one of ours. */
function neighbourEffect(d: BackgroundDial, side: number, dials: BackgroundDial[], out: Map<string, string | undefined>, peers: PeerInfo[]): string | undefined {
    const at: Pick<BusAction, "device" | "column" | "row" | "controller"> = { device: d.device, column: d.column, row: 0, controller: "Encoder" };
    const theirs = neighbours(peers, at).find((n) => n.side === (side < 0 ? "left" : "right") && typeof n.action.effect === "string" && n.action.effect);
    if (theirs) return theirs.action.effect as string;
    const ours = dials.find((o) => o !== d && o.device === d.device && o.column === d.column + side);
    return ours ? out.get(ours.context) : undefined;
}

/**
 * The PI choices: like the neighbour, none, then every effect. The plugin passes the two labels in
 * its language (this runs in the plugin, where the kit's PI texts aren't available).
 */
export function backgroundOptions(labels: { auto: string; none: string }): { value: string; label: string }[] {
    return [{ value: BACKGROUND_AUTO, label: labels.auto }, { value: BACKGROUND_NONE, label: labels.none }, ...listEffects().map((e) => ({ value: e.id, label: e.displayName }))];
}
