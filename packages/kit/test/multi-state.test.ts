import { describe, expect, it } from 'vitest';
import { nextIndex, renderMultiStateKey, stateOptions } from '../src/multi-state/index.js';

const svgOf = (uri: string) => Buffer.from(uri.split(',')[1], 'base64').toString();

describe('multi-state', () => {
    it('keeps rows with a value, trimmed', () => {
        expect(stateOptions([{ value: ' low ', label: 'Low', color: '#fff' }, { value: '' }, null, 'x', { label: 'no value' }])).toEqual([{ value: 'low', label: 'Low', icon: undefined, color: '#fff' }]);
        expect(stateOptions(undefined)).toEqual([]);
    });

    it('steps on and wraps, starting at the first when unknown', () => {
        expect(nextIndex(0, 3)).toBe(1);
        expect(nextIndex(2, 3)).toBe(0);
        expect(nextIndex(-1, 3)).toBe(0);
        expect(nextIndex(0, 0)).toBe(-1);
    });

    it('draws the state in its colour with one dot per state', () => {
        const svg = svgOf(renderMultiStateKey({ index: 1, count: 3, icon: 'M0 0h24v24H0z', color: '#E14190', text: 'Headset', offline: false }));
        expect(svg).toContain('fill="#E14190"');
        expect(svg).toContain('Headset');
        expect(svg.match(/<circle/g)).toHaveLength(3);
    });

    it('greys out an unknown state and dims an offline key', () => {
        expect(svgOf(renderMultiStateKey({ index: -1, count: 2, icon: 'M0 0', color: '#E14190', offline: false }))).not.toContain('#E14190');
        expect(svgOf(renderMultiStateKey({ index: 0, count: 2, icon: 'M0 0', color: '#E14190', offline: true }))).toContain('opacity="0.35"');
    });
});
