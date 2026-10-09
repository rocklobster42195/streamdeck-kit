// Panorama effect lifecycle: creates one effect instance per group, ticks it, feeds merged
// settings into it, and asks every member display to redraw after each tick (so all displays of a
// group render from the exact same frame).
//
// Extracted from sonos-controller's PanoramaEffectsDial (src/actions/panorama-effects-dial.ts),
// without its Sonos device/cover-color handling: the host passes colors in as ordinary effect
// settings (e.g. `color`), the first group member that sets a value wins. Live settings (from
// outside sources such as HA entities, see updateLive) win over picked ones.
import { DISPLAY_H, DISPLAY_W, PanoramaOrchestrator, safeEffectCall } from './orchestrator.js';
import { DEFAULT_EFFECT_ID, effectRegistry } from './registry.js';
import type { EffectInstance } from './types.js';

export type PanoramaEngineOptions = {
    /** Tick interval for effects without `preferredTickMs`. */
    defaultTickMs?: number;
    /** Fallback `color` when no member provides one. */
    defaultColor?: string;
};

type Group = { ctxs: string[]; effectId: string; timer: ReturnType<typeof setInterval> };

export class PanoramaEngine {
    readonly orchestrator = new PanoramaOrchestrator();
    private readonly groups = new Map<string, Group>();
    /** Audio level 0..1 per display that has an audio source (see setLevel). */
    private readonly levels = new Map<string, number>();
    private readonly defaultTickMs: number;
    private readonly defaultColor: string;

    constructor(options: PanoramaEngineOptions = {}) {
        this.defaultTickMs = options.defaultTickMs ?? 100;
        this.defaultColor = options.defaultColor ?? '#6cc4ff';
        this.orchestrator.setGroupSyncHandler((grouping) => this.sync(grouping));
        this.orchestrator.setSettingsChangeHandler((ctxs) => this.pushSettings(ctxs));
    }

    // ---- API for dial actions ----------------------------------------------------------------

    /** Join (or update) the panorama with an effect; `settings` are this display's effect settings. */
    join(context: string, deviceId: string, column: number, effectId: string, settings: Record<string, unknown>, redraw: () => void): void {
        const o = this.orchestrator;
        o.registerRenderCallback(context, redraw);
        // Only on the first join — later changes go through updateSettings() (compared + pushed)
        if (!o.contextEffectSettings.has(context)) o.contextEffectSettings.set(context, settings);
        if (o.panoramaColumns.get(context) !== column || o.panoramaDeviceIds.get(context) !== deviceId) o.registerInPanorama(context, column, deviceId);
        o.setContextEffectId(context, effectId);
    }

    /** Update this display's effect settings (debounced push into the running effect). */
    updateSettings(context: string, settings: Record<string, unknown>): void {
        const prev = this.orchestrator.contextEffectSettings.get(context);
        if (prev && JSON.stringify(prev) === JSON.stringify(settings)) return;
        this.orchestrator.setContextEffectSettings(context, settings);
    }

    /**
     * Settings that follow an outside source (e.g. a colour from a Home Assistant light): in the
     * group they win over every member's picked settings. A change goes into the running effect
     * like any settings change, so the last change wins over rotating the dial.
     */
    updateLive(context: string, live: Record<string, unknown>): void {
        const prev = this.orchestrator.contextLiveSettings.get(context) ?? {};
        if (JSON.stringify(prev) === JSON.stringify(live)) return;
        this.orchestrator.setContextLiveSettings(context, live);
    }

    leave(context: string): void {
        this.levels.delete(context);
        this.orchestrator.unregisterFromPanorama(context);
    }

    /**
     * The audio level 0..1 of this display's audio source, or undefined when it has none. A group
     * moves with the loudest of its displays; effects without setLevel ignore it.
     */
    setLevel(context: string, level: number | undefined): void {
        if (level === undefined) this.levels.delete(context);
        else this.levels.set(context, Math.min(1, Math.max(0, level)));
    }

    /** SVG fragment of this display's slice of its group's effect ('' when none is running). */
    renderSlice(context: string): string {
        const effect = this.effectFor(context);
        if (!effect) return '';
        const offset = this.orchestrator.getPanoramaSliceOffset(context);
        return safeEffectCall(() => effect.renderSlice(offset, DISPLAY_W, DISPLAY_H), '', 'renderSlice');
    }

    /** The displays of this context's group, left to right ([] while it isn't in a running group). */
    members(context: string): { context: string; column: number }[] {
        const key = this.orchestrator.panoramaContextGroupKey.get(context);
        const g = key ? this.groups.get(key) : undefined;
        return (g?.ctxs ?? [])
            .map((c) => ({ context: c, column: this.orchestrator.panoramaColumns.get(c) ?? 0 }))
            .sort((a, b) => a.column - b.column);
    }

    isActive(context: string): boolean {
        return !!this.effectFor(context);
    }

    /** Forward dial input to the effect (only for a dedicated effect dial). */
    rotate(context: string, ticks: number): void {
        const e = this.effectFor(context);
        if (e?.onRotate) safeEffectCall(() => e.onRotate!(ticks), undefined, 'onRotate');
    }

    press(context: string): void {
        const e = this.effectFor(context);
        if (e?.onPress) safeEffectCall(() => e.onPress!(), undefined, 'onPress');
    }

    touch(context: string, x: number, y: number): void {
        const e = this.effectFor(context);
        if (e?.onTouch) safeEffectCall(() => e.onTouch!(x + this.orchestrator.getPanoramaSliceOffset(context), y), undefined, 'onTouch');
    }

    /** What rotating can change on this context's effect (see EffectInstance.getControls). */
    controls(context: string): string[] {
        const e = this.effectFor(context);
        return (e?.getControls ? safeEffectCall(() => e.getControls!(), undefined, 'getControls') : undefined) ?? [];
    }

    control(context: string): string | undefined {
        const e = this.effectFor(context);
        return e?.getControl ? safeEffectCall(() => e.getControl!(), undefined, 'getControl') : undefined;
    }

    setControl(context: string, id: string): void {
        const e = this.effectFor(context);
        if (e?.setControl) safeEffectCall(() => e.setControl!(id), undefined, 'setControl');
    }

    /** Settings the effect changed itself (e.g. speed after rotating) that the host should persist. */
    runtimeSettings(context: string): Record<string, unknown> | undefined {
        const e = this.effectFor(context);
        return e?.getRuntimeSettings ? safeEffectCall(() => e.getRuntimeSettings!() as Record<string, unknown>, undefined, 'getRuntimeSettings') : undefined;
    }

    indicator(context: string): number | undefined {
        const e = this.effectFor(context);
        return e?.getIndicatorValue ? safeEffectCall(() => e.getIndicatorValue!(), undefined, 'getIndicatorValue') : undefined;
    }

    /** Stop everything (plugin shutdown / tests). */
    dispose(): void {
        for (const key of [...this.groups.keys()]) this.destroyGroup(key);
    }

    // ---- lifecycle ----------------------------------------------------------------------------

    private effectFor(context: string): EffectInstance<any> | undefined {
        const key = this.orchestrator.panoramaContextGroupKey.get(context);
        return key ? this.orchestrator.groupEffects.get(key) : undefined;
    }

    private sync(grouping: Map<string, string[]>): void {
        const o = this.orchestrator;
        // Tear down groups that no longer exist or whose members/effect changed
        for (const [key, g] of [...this.groups]) {
            const next = grouping.get(key);
            const wanted = next && (o.contextEffectId.get(next[0]) ?? DEFAULT_EFFECT_ID);
            if (!next || wanted !== g.effectId || next.join('|') !== g.ctxs.join('|')) this.destroyGroup(key);
        }
        for (const [key, ctxs] of grouping) {
            if (this.groups.has(key)) continue;
            this.createGroup(key, ctxs);
        }
        // Every member back to its group, also in groups that stayed: a display that left and came
        // back within one debounced sync lost its link (leave() drops it) while its group stayed the
        // same, and was never drawn again (seen 2026-10-09: another plugin's dial in a shared
        // Panorama stayed black after that plugin restarted)
        for (const [key, ctxs] of grouping) for (const ctx of ctxs) o.panoramaContextGroupKey.set(ctx, key);
        o.notifyGroupRender([...grouping.values()].flat());
    }

    private createGroup(key: string, ctxs: string[]): void {
        const o = this.orchestrator;
        const effectId = o.contextEffectId.get(ctxs[0]) ?? DEFAULT_EFFECT_ID;
        const def = effectRegistry.get(effectId) ?? effectRegistry.get(DEFAULT_EFFECT_ID)!;
        const instance = def.createInstance();
        safeEffectCall(() => instance.initPanorama({ width: ctxs.length * DISPLAY_W, height: DISPLAY_H, settings: this.merged(ctxs) }), undefined, 'initPanorama');
        o.groupEffects.set(key, instance);
        for (const ctx of ctxs) o.panoramaContextGroupKey.set(ctx, key);
        const tickMs = def.preferredTickMs ?? this.defaultTickMs;
        const timer = setInterval(() => {
            if (instance.setLevel) {
                const levels = ctxs.map((c) => this.levels.get(c)).filter((l): l is number => l !== undefined);
                safeEffectCall(() => instance.setLevel!(levels.length ? Math.max(...levels) : undefined), undefined, 'setLevel');
            }
            safeEffectCall(() => instance.tickPanorama(tickMs), undefined, 'tickPanorama');
            o.notifyGroupRender(ctxs);
        }, tickMs);
        this.groups.set(key, { ctxs, effectId: def.id, timer });
    }

    private destroyGroup(key: string): void {
        const o = this.orchestrator;
        const g = this.groups.get(key);
        if (g) clearInterval(g.timer);
        this.groups.delete(key);
        const effect = o.groupEffects.get(key);
        if (effect?.destroy) safeEffectCall(() => effect.destroy!(), undefined, 'destroy');
        o.groupEffects.delete(key);
        for (const [ctx, k] of [...o.panoramaContextGroupKey]) if (k === key) o.panoramaContextGroupKey.delete(ctx);
    }

    private pushSettings(changed: Iterable<string>): void {
        const changedSet = new Set(changed);
        for (const [key, g] of this.groups) {
            if (!g.ctxs.some((c) => changedSet.has(c))) continue;
            // The edited display goes first, so its new values win the "first member wins" merge
            const ordered = [...g.ctxs.filter((c) => changedSet.has(c)), ...g.ctxs.filter((c) => !changedSet.has(c))];
            const effect = this.orchestrator.groupEffects.get(key);
            if (effect?.onSettingsChange) safeEffectCall(() => effect.onSettingsChange!(this.merged(ordered)), undefined, 'onSettingsChange');
            this.orchestrator.notifyGroupRender(g.ctxs);
        }
    }

    /**
     * All members' settings merged: live settings first, then picked ones; within each, the first
     * member with a defined value wins each key.
     */
    private merged(ctxs: string[]): Record<string, unknown> {
        const merged: Record<string, unknown> = {};
        for (const source of [this.orchestrator.contextLiveSettings, this.orchestrator.contextEffectSettings]) {
            for (const ctx of ctxs) {
                for (const [k, v] of Object.entries(source.get(ctx) ?? {})) {
                    if (v !== undefined && v !== '' && merged[k] === undefined) merged[k] = v;
                }
            }
        }
        merged.color ??= this.defaultColor;
        return merged;
    }
}
