import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanoramaEngine } from '../src/panorama/engine.js';
import { effectRegistry, listEffects, withEffectDefaults } from '../src/panorama/registry.js';

describe('effect registry', () => {
    it('contains the four built-in effects with PI-ready schemas', () => {
        expect([...effectRegistry.keys()].sort()).toEqual(['boing-ball', 'boing-globe', 'matrix-rain', 'particles'].sort());
        for (const e of listEffects()) expect(Array.isArray(e.settingsSchema)).toBe(true);
    });
    it('fills in missing schema defaults', () => {
        const id = listEffects().find((e) => e.settingsSchema.length)!.id;
        const { settings, changed } = withEffectDefaults({}, id);
        expect(changed).toBe(true);
        expect(Object.keys(settings).length).toBeGreaterThan(0);
    });
});

describe('PanoramaEngine', () => {
    afterEach(() => vi.useRealTimers());

    it('groups adjacent dials with the same effect and renders a slice for each', async () => {
        vi.useFakeTimers();
        const engine = new PanoramaEngine();
        const redraws = { a: 0, b: 0 };
        engine.join('a', 'dev', 0, 'particles', {}, () => redraws.a++);
        engine.join('b', 'dev', 1, 'particles', {}, () => redraws.b++);
        await vi.advanceTimersByTimeAsync(200);
        expect(engine.isActive('a') && engine.isActive('b')).toBe(true);
        expect(engine.orchestrator.panoramaContextGroupKey.get('a')).toBe(engine.orchestrator.panoramaContextGroupKey.get('b'));
        expect(engine.orchestrator.getPanoramaSliceOffset('b')).toBe(200);
        expect(engine.renderSlice('a').length).toBeGreaterThan(0);
        expect(engine.members('b')).toEqual([
            { context: 'a', column: 0 },
            { context: 'b', column: 1 },
        ]);
        // both displays redraw from the shared group tick
        expect(redraws.a).toBeGreaterThan(0);
        expect(redraws.b).toBeGreaterThan(0);
        engine.dispose();
    });

    it('keeps neighbours with different effects apart and cleans up on leave', async () => {
        vi.useFakeTimers();
        const engine = new PanoramaEngine();
        engine.join('a', 'dev', 0, 'particles', {}, () => {});
        engine.join('b', 'dev', 1, 'matrix-rain', {}, () => {});
        await vi.advanceTimersByTimeAsync(200);
        expect(engine.orchestrator.panoramaContextGroupKey.get('a')).not.toBe(engine.orchestrator.panoramaContextGroupKey.get('b'));
        engine.leave('b');
        await vi.advanceTimersByTimeAsync(200);
        expect(engine.isActive('b')).toBe(false);
        expect(engine.isActive('a')).toBe(true);
        engine.dispose();
    });

    it('switches the running effect when a display picks another one', async () => {
        vi.useFakeTimers();
        const engine = new PanoramaEngine();
        engine.join('a', 'dev', 0, 'particles', {}, () => {});
        await vi.advanceTimersByTimeAsync(200);
        const before = engine.orchestrator.groupEffects.get(engine.orchestrator.panoramaContextGroupKey.get('a')!);
        engine.join('a', 'dev', 0, 'boing-ball', {}, () => {});
        await vi.advanceTimersByTimeAsync(200);
        const after = engine.orchestrator.groupEffects.get(engine.orchestrator.panoramaContextGroupKey.get('a')!);
        expect(after).toBeDefined();
        expect(after).not.toBe(before);
        engine.dispose();
    });
});
