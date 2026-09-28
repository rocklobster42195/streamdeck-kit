// All built-in panorama effects. sonos-controller generates its registry (tools/
// generate-effects-registry.mjs); here the list is explicit — adding an effect means adding a line.
import blank from './effects/blank/index.js';
import boingBall from './effects/boing-ball/index.js';
import boingGlobe from './effects/boing-globe/index.js';
import matrixRain from './effects/matrix-rain/index.js';
import particles from './effects/particles/index.js';
import type { EffectDefinition, EffectField } from './types.js';

export const effectRegistry = new Map<string, EffectDefinition<any>>(
    [particles, matrixRain, boingBall, boingGlobe, blank].map((def) => [def.id, def as EffectDefinition<any>]),
);

export const DEFAULT_EFFECT_ID = particles.id;
/** "No effect" on a dial that still needs a group (e.g. lyrics across neighbouring displays). */
export const BLANK_EFFECT_ID = blank.id;

/** Serializable description of an effect for a property inspector (id, name, settings fields). */
export type EffectInfo = { id: string; displayName: string; settingsSchema: EffectField[] };

export function listEffects(): EffectInfo[] {
    return [...effectRegistry.values()].filter((d) => !d.hidden).map((d) => ({ id: d.id, displayName: d.displayName, settingsSchema: d.settingsSchema }));
}

/**
 * Fill in `effectId`'s schema defaults that are missing from `settings` (ported from
 * sonos-controller's backfillEffectDefaults). `changed` tells whether anything was added.
 */
export function withEffectDefaults(settings: Record<string, unknown>, effectId: string | undefined): { settings: Record<string, unknown>; changed: boolean } {
    const def = effectId ? effectRegistry.get(effectId) : undefined;
    if (!def) return { settings, changed: false };
    let changed = false;
    const result: Record<string, unknown> = { ...settings };
    for (const field of def.settingsSchema) {
        if (result[field.key] === undefined) {
            result[field.key] = field.default;
            changed = true;
        }
    }
    return { settings: result, changed };
}
