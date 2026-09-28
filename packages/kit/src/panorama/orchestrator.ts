// Panorama grouping: which dials sit next to each other (same device, adjacent columns, same
// effect) and therefore share one effect instance spanning their touch strips.
//
// Ported from sonos-controller (src/effects/PanoramaOrchestrator.ts), device-agnostic: no Stream
// Deck import (logging is injectable) and no back-compat function exports. The effect lifecycle
// (create, tick, settings) lives in engine.ts.
import type { EffectInstance } from './types.js';

export const DISPLAY_W = 200;
export const DISPLAY_H = 100;

export type GroupSyncHandler = (newGrouping: Map<string, string[]>) => Promise<void> | void;
export type SettingsChangeHandler = (contexts: Iterable<string>) => void;
export type PanoramaLogger = { error(...args: unknown[]): void };

let logger: PanoramaLogger = console;

/** Route panorama errors (e.g. a throwing effect) to the host's logger. */
export function setPanoramaLogger(l: PanoramaLogger): void {
    logger = l;
}

/**
 * Every call into effect-supplied code goes through this, so one broken effect skips a frame or an
 * interaction instead of taking down the whole plugin process.
 */
export function safeEffectCall<T>(fn: () => T, fallback: T, what: string): T {
    try {
        return fn();
    } catch (e) {
        logger.error(`Panorama effect threw in ${what} — ignoring this call: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
        return fallback;
    }
}

export class PanoramaOrchestrator {
    readonly panoramaColumns = new Map<string, number>();
    /** Physical device per context — columns are only unique within one device. */
    readonly panoramaDeviceIds = new Map<string, string>();
    readonly panoramaContextGroupKey = new Map<string, string>();
    /** Which effect each context wants; only neighbours wanting the same effect merge. */
    readonly contextEffectId = new Map<string, string>();
    /** Each context's effect settings (merged per group by the engine). */
    readonly contextEffectSettings = new Map<string, Record<string, unknown>>();
    /** Running effect instance per group key (owned by the engine). */
    readonly groupEffects = new Map<string, EffectInstance<any>>();
    /** Per-context "redraw now" callbacks, called for all members after every group tick. */
    readonly renderCallbacks = new Map<string, () => void>();

    private handler: GroupSyncHandler | null = null;
    private syncTimer: ReturnType<typeof setTimeout> | null = null;
    private settingsHandler: SettingsChangeHandler | null = null;
    private settingsTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly pendingSettingsContexts = new Set<string>();

    setGroupSyncHandler(handler: GroupSyncHandler): void {
        this.handler = handler;
    }

    setSettingsChangeHandler(handler: SettingsChangeHandler): void {
        this.settingsHandler = handler;
    }

    registerInPanorama(context: string, column: number, deviceId: string): void {
        this.panoramaColumns.set(context, column);
        this.panoramaDeviceIds.set(context, deviceId);
        this.requestSync();
    }

    unregisterFromPanorama(context: string): void {
        this.panoramaContextGroupKey.delete(context);
        this.panoramaColumns.delete(context);
        this.panoramaDeviceIds.delete(context);
        this.contextEffectId.delete(context);
        this.contextEffectSettings.delete(context);
        this.renderCallbacks.delete(context);
        this.requestSync();
    }

    setContextEffectId(context: string, effectId: string): void {
        if (this.contextEffectId.get(context) === effectId) return;
        this.contextEffectId.set(context, effectId);
        this.requestSync();
    }

    /** Settings don't affect grouping — only what is fed into the running effect. */
    setContextEffectSettings(context: string, settings: Record<string, unknown>): void {
        this.contextEffectSettings.set(context, settings);
        this.pendingSettingsContexts.add(context);
        if (this.settingsTimer) clearTimeout(this.settingsTimer);
        this.settingsTimer = setTimeout(() => {
            this.settingsTimer = null;
            const contexts = [...this.pendingSettingsContexts];
            this.pendingSettingsContexts.clear();
            this.settingsHandler?.(contexts);
        }, 60);
    }

    registerRenderCallback(context: string, cb: () => void): void {
        this.renderCallbacks.set(context, cb);
    }

    notifyGroupRender(ctxs: Iterable<string>): void {
        for (const ctx of ctxs) this.renderCallbacks.get(ctx)?.();
    }

    getPanoramaSliceOffset(context: string): number {
        const col = this.panoramaColumns.get(context) ?? 0;
        const key = this.panoramaContextGroupKey.get(context);
        if (!key) return 0;
        return (col - Math.min(...this.colsFromKey(key))) * DISPLAY_W;
    }

    panoramaKey(deviceId: string, cols: number[]): string {
        return 'panorama-' + deviceId + '-cols-' + [...cols].sort((a, b) => a - b).join(',');
    }

    colsFromKey(key: string): number[] {
        return key.slice(key.lastIndexOf('-cols-') + '-cols-'.length).split(',').map(Number);
    }

    /**
     * Connected components over column adjacency on the same device, only merging neighbours that
     * want the same effect. Returns Map<groupKey, contexts[]>.
     */
    computeAllGroups(): Map<string, string[]> {
        const sorted = [...this.panoramaColumns.entries()].sort(([ctxA, a], [ctxB, b]) => {
            const devA = this.panoramaDeviceIds.get(ctxA) ?? '';
            const devB = this.panoramaDeviceIds.get(ctxB) ?? '';
            if (devA !== devB) return devA < devB ? -1 : 1;
            return a - b;
        });
        const result = new Map<string, string[]>();
        let i = 0;
        while (i < sorted.length) {
            const deviceId = this.panoramaDeviceIds.get(sorted[i][0]) ?? '';
            const cols = [sorted[i][1]];
            const ctxs = [sorted[i][0]];
            const effectId = this.contextEffectId.get(sorted[i][0]);
            while (
                i + 1 < sorted.length &&
                (this.panoramaDeviceIds.get(sorted[i + 1][0]) ?? '') === deviceId &&
                sorted[i + 1][1] === sorted[i][1] + 1 &&
                this.contextEffectId.get(sorted[i + 1][0]) === effectId
            ) {
                i++;
                cols.push(sorted[i][1]);
                ctxs.push(sorted[i][0]);
            }
            result.set(this.panoramaKey(deviceId, cols), ctxs);
            i++;
        }
        return result;
    }

    /** Debounce rapid appear/disappear events so one sync handles all of them. */
    requestSync(): void {
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncTimer = null;
            void this.handler?.(this.computeAllGroups());
        }, 60);
    }
}
