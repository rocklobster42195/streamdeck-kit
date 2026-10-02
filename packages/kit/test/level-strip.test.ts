import { describe, expect, it } from 'vitest';
import { inkOn, levelStyleShowsMeter, renderLevelStrip, type LevelStripView } from '../src/render/level-strip.js';

const svg = (uri: string) => Buffer.from(uri.split(',')[1], 'base64').toString();
const view: LevelStripView = { style: 'digital', name: 'Vocals', valueText: '-3.5 dB', position: 0.7, color: '#E30018', muted: false, levels: [-20, -18], peaks: [-10, -9], vus: [-3, -2] };

describe('level strip', () => {
    for (const style of ['digital', 'classic', 'ring', 'pie'] as const) {
        it(`${style}: shows the value, MUTE when muted, a backing only over an effect`, () => {
            expect(svg(renderLevelStrip({ ...view, style }))).toContain('-3.5 dB');
            expect(svg(renderLevelStrip({ ...view, style, muted: true }))).toContain('MUTE');
            expect(svg(renderLevelStrip({ ...view, style }))).not.toContain('opacity="0.55"');
            expect(svg(renderLevelStrip({ ...view, style, background: '<g id="fx"/>' }))).toContain('<g id="fx"/>');
        });
    }

    it('draws an inactive dial grey, without its level, and never as muted', () => {
        const s = svg(renderLevelStrip({ ...view, inactive: true, muted: true, icon: 'data:image/png;base64,AAAA' }));
        expect(s).not.toContain('MUTE');
        expect(s).toContain('#8a8a90');
    });

    it('a send name goes on two lines in the ring look', () => {
        const s = svg(renderLevelStrip({ ...view, style: 'ring', subName: '→ Reverb', caption: 'PRE' }));
        expect(s).toContain('→ Reverb');
        expect(s).toContain('PRE');
    });

    it('knows which looks need meter data, and black or white text on a colour', () => {
        expect(levelStyleShowsMeter('digital')).toBe(true);
        expect(levelStyleShowsMeter('pie')).toBe(false);
        expect(inkOn('#FFDD00')).toBe('#000000');
        expect(inkOn('#005DA0')).toBe('#FFFFFF');
    });
});
