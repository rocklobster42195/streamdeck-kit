import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanoramaEngine } from '../src/panorama/engine.js';
import { effectRegistry, listEffects, withEffectDefaults } from '../src/panorama/registry.js';

describe('effect registry', () => {
    it('contains the four built-in effects with PI-ready schemas, plus the hidden blank one', () => {
        expect([...effectRegistry.keys()].sort()).toEqual(['blank', 'boing-ball', 'boing-globe', 'matrix-rain', 'particles'].sort());
        expect(listEffects().map((e) => e.id).sort()).toEqual(['boing-ball', 'boing-globe', 'matrix-rain', 'particles'].sort());
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

describe('audio level', () => {
    it('passes the loudest display level of a group to the effect, undefined without a source', async () => {
        const { PanoramaEngine, effectRegistry } = await import('../src/panorama/index.js');
        const seen: (number | undefined)[] = [];
        effectRegistry.set('level-probe', {
            id: 'level-probe',
            displayName: 'Probe',
            hidden: true,
            defaultSettings: {},
            settingsSchema: [],
            preferredTickMs: 10,
            createInstance: () => ({ initPanorama() {}, tickPanorama() {}, renderSlice: () => '', setLevel: (l: number | undefined) => void seen.push(l) }),
        });
        const engine = new PanoramaEngine();
        engine.join('a', 'dev', 0, 'level-probe', {}, () => {});
        await new Promise((r) => setTimeout(r, 150));
        engine.setLevel('a', 0.7);
        await new Promise((r) => setTimeout(r, 60));
        engine.setLevel('a', undefined);
        await new Promise((r) => setTimeout(r, 60));
        engine.dispose();
        effectRegistry.delete('level-probe');
        expect(seen).toContain(0.7);
        expect(seen.at(-1)).toBeUndefined();
    });
});

describe('colour changes reach the effect quickly', () => {
    it('Particles: the fade to a new colour takes about 800 ms whatever the tick interval', () => {
        const inst = effectRegistry.get('particles')!.createInstance();
        inst.initPanorama({ width: 200, height: 100, settings: { color: '#000000' } });
        inst.onSettingsChange!({ color: '#ff0000' });
        for (let i = 0; i < 3; i++) inst.tickPanorama(100);
        expect(inst.renderSlice(0, 200, 100)).not.toContain('rgb(255,0,0)');
        for (let i = 0; i < 5; i++) inst.tickPanorama(100);
        expect(inst.renderSlice(0, 200, 100)).toContain('rgb(255,0,0)');
        inst.destroy?.();
    });

    it('Matrix Rain: pixels already drawn take the new colour at once', () => {
        const inst = effectRegistry.get('matrix-rain')!.createInstance() as unknown as {
            initPanorama(c: unknown): void;
            tickPanorama(dt: number): void;
            onSettingsChange(s: unknown): void;
            frame: Uint8ClampedArray;
        };
        inst.initPanorama({ width: 200, height: 100, settings: { color: '#22C55E', savedDensity: 1.5 } });
        for (let i = 0; i < 150; i++) inst.tickPanorama(100);
        let green = 0;
        for (let i = 0; i < inst.frame.length; i += 4) if (inst.frame[i + 1] > 40) green++;
        expect(green).toBeGreaterThan(0);
        inst.onSettingsChange({ color: '#ff0000' });
        let wrong = 0;
        for (let i = 0; i < inst.frame.length; i += 4) if (inst.frame[i + 1] > 55 || inst.frame[i + 2] > 55 || inst.frame[i + 1] > inst.frame[i]) wrong++;
        expect(wrong).toBe(0);
    });
});
