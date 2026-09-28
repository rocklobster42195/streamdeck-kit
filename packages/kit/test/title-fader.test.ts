import { describe, expect, it } from 'vitest';
import { SONOS_TITLE_FADER, TitleFader } from '../src/render/title-fader.js';

const opacity = (svg: string, attr: string) => Number(new RegExp(`${attr}="([0-9.]+)"`).exec(svg)?.[1] ?? 0);
const textX = (svg: string) => Number(/<text x="(-?[\d.]+)"/.exec(svg)?.[1]);

describe('TitleFader (sonos TitleAnimator port)', () => {
    it('fades the band in first, then the text, then scrolls at a constant step', () => {
        const f = new TitleFader('A title that is far too long for one key');
        expect(f.svg()).toBe(''); // nothing before the first tick
        for (let i = 0; i < 6; i++) f.step();
        let svg = f.svg();
        expect(opacity(svg, 'fill-opacity')).toBeCloseTo(0.3); // band at its max …
        expect(svg).not.toContain('<text'); // … and no text yet

        f.step();
        svg = f.svg();
        expect(svg).toContain('<text');
        const xs = [textX(svg)];
        for (let i = 0; i < 5; i++) {
            f.step();
            xs.push(textX(f.svg()));
        }
        const steps = xs.slice(1).map((x, i) => +(xs[i] - x).toFixed(2));
        expect(new Set(steps)).toEqual(new Set([SONOS_TITLE_FADER.speed])); // same px every tick
    });

    it('fades out in reverse and pauses, then starts over', () => {
        const f = new TitleFader('Short');
        const seen: string[] = [];
        let quiet = 0;
        for (let i = 0; i < 400; i++) {
            const changed = f.step();
            if (!changed) quiet++;
            const svg = f.svg();
            seen.push(svg === '' ? 'empty' : svg.includes('<text') ? 'text' : 'band');
        }
        // band → text → band → empty (pause) → band again
        const order = seen.filter((s, i) => s !== seen[i - 1]);
        expect(order.slice(0, 5)).toEqual(['band', 'text', 'band', 'empty', 'band']);
        expect(quiet).toBeGreaterThan(SONOS_TITLE_FADER.pauseTicks); // still-stand and pause send no frames
    });

    it('centers short titles and restarts on a new title', () => {
        const f = new TitleFader('Hi');
        for (let i = 0; i < 20; i++) f.step();
        const x = textX(f.svg());
        expect(x).toBeGreaterThan(SONOS_TITLE_FADER.startX);
        f.setText('Hi'); // same text keeps running
        expect(f.svg()).toContain('<text');
        f.setText('Another');
        expect(f.svg()).toBe('');
    });
});
