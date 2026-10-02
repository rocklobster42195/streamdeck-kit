import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanoramaEngine } from '../src/panorama/engine.js';
import { effectRange, parseColor, scaleToEffect } from '../src/panorama/inputs.js';

describe('effect inputs', () => {
    it('reads colours in the forms HA and text helpers use', () => {
        expect(parseColor('#f80')).toBe('#FF8800');
        expect(parseColor('255, 136, 0')).toBe('#FF8800');
        expect(parseColor('rgb(255,136,0)')).toBe('#FF8800');
        expect(parseColor([255, 136, 0])).toBe('#FF8800');
        expect(parseColor('hs(0, 100)')).toBe('#FF0000');
        expect(parseColor({ h: 120, s: 100 })).toBe('#00FF00');
        expect(parseColor('Rot')).toBe('#FF0000');
        expect(parseColor('Endeavour')).toBe('#005DA0');
        expect(parseColor('on')).toBeUndefined();
        expect(parseColor('300,0,0')).toBeUndefined();
        expect(parseColor(42)).toBeUndefined();
    });

    it('scales a number onto an effect setting\'s range, rounded to its step', () => {
        const r = effectRange('boing-ball', 'savedSpeed')!;
        expect(r).toMatchObject({ min: 1, max: 5, step: 1 });
        expect(scaleToEffect('boing-ball', 'savedSpeed', 0, 0, 100)).toBe(1);
        expect(scaleToEffect('boing-ball', 'savedSpeed', 50, 0, 100)).toBe(3);
        expect(scaleToEffect('boing-ball', 'savedSpeed', 500, 0, 100)).toBe(5);
        expect(scaleToEffect('boing-ball', 'savedDensity', 50, 0, 100)).toBeUndefined();
        expect(scaleToEffect('boing-ball', 'savedSpeed', 5, 10, 10)).toBeUndefined();
    });
});

describe('live settings', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('win over every member\'s picked settings in the group', () => {
        const engine = new PanoramaEngine();
        const seen: Record<string, unknown>[] = [];
        engine.join('a', 'deck', 0, 'particles', { color: '#111111' }, () => {});
        engine.join('b', 'deck', 1, 'particles', {}, () => {});
        vi.advanceTimersByTime(100);
        const effect = engine.orchestrator.groupEffects.values().next().value!;
        effect.onSettingsChange = (s: Record<string, unknown>) => seen.push(s);
        engine.updateLive('b', { color: '#FF0000' });
        vi.advanceTimersByTime(100);
        expect(seen.at(-1)?.color).toBe('#FF0000');
        // A picked change later doesn't beat the live one
        engine.updateSettings('a', { color: '#222222' });
        vi.advanceTimersByTime(100);
        expect(seen.at(-1)?.color).toBe('#FF0000');
        engine.updateLive('b', {});
        vi.advanceTimersByTime(100);
        expect(seen.at(-1)?.color).toBe('#222222');
        engine.dispose();
    });
});
