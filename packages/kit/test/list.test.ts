import { describe, expect, it } from 'vitest';
import { FrameTicker } from '../src/render/animation.js';
import { ListController, listStrip, ScrollList, type ListRow } from '../src/list/index.js';

const svg = (uri: string) => Buffer.from(uri.split(',')[1], 'base64').toString();

function clocked() {
    let now = 1000;
    return { clock: () => now, advance: (ms: number) => (now += ms) };
}

describe('ScrollList', () => {
    it('moves one row per tick and glides there', () => {
        const c = clocked();
        const l = new ScrollList({ clock: c.clock, glideMs: 200 });
        l.reset(10, 2);
        l.rotate(1);
        expect(l.index).toBe(3);
        expect(l.position).toBe(2);
        c.advance(100);
        expect(l.position).toBeGreaterThan(2.5);
        expect(l.position).toBeLessThan(3);
        expect(l.moving).toBe(true);
        c.advance(150);
        expect(l.position).toBe(3);
        expect(l.moving).toBe(false);
    });

    it('marks the row nearest the centre, switching halfway in both directions', () => {
        const c = clocked();
        const l = new ScrollList({ clock: c.clock, glideMs: 1000 });
        l.reset(10, 2);
        l.rotate(1);
        c.advance(100); // ease-out: past halfway quickly
        expect(l.marked).toBe(l.position >= 2.5 ? 3 : 2);
        c.advance(1000);
        l.rotate(-1);
        c.advance(1);
        expect(l.marked).toBe(3);
        c.advance(1000);
        expect(l.marked).toBe(2);
    });

    it('moves two rows per tick on fast spins', () => {
        const l = new ScrollList();
        l.reset(20, 0);
        l.rotate(2);
        expect(l.index).toBe(2);
        l.rotate(3);
        expect(l.index).toBe(8);
    });

    it('stops at the ends with a short rubber-band nudge', () => {
        const c = clocked();
        const l = new ScrollList({ clock: c.clock, bounceMs: 200, bounceRows: 0.15 });
        l.reset(3, 2);
        l.rotate(1);
        expect(l.index).toBe(2);
        c.advance(100);
        expect(l.position).toBeGreaterThan(2.1);
        expect(l.marked).toBe(2);
        c.advance(150);
        expect(l.position).toBe(2);
        expect(l.moving).toBe(false);
    });

    it('keeps the index inside a list that got shorter', () => {
        const l = new ScrollList();
        l.reset(10, 8);
        l.setLength(5);
        expect(l.index).toBe(4);
        expect(l.position).toBe(4);
    });
});

const rows: ListRow[] = [
    { title: 'First Album', subtitle: 'Some Band', icon: 'M0 0h24v24H0z' },
    { title: 'Second Album', subtitle: 'Other Band', image: 'data:image/png;base64,AAAA', active: true },
    { title: 'A Folder', folder: true, icon: 'M0 0h24v24H0z' },
    { title: 'Plain text row' },
];

describe('listStrip', () => {
    const view = { count: rows.length, row: (i: number) => rows[i], position: 1, marked: 1, accent: '#009FDF' };

    it('draws the rows around the centre, the active title in the accent colour', () => {
        const s = svg(listStrip(view));
        expect(s).toContain('First Album');
        expect(s).toContain('Second Album');
        expect(s).toContain('A Folder');
        expect(s).not.toContain('Plain text row'); // two rows away: outside the strip
        expect(s).toMatch(/fill="#009FDF"[^>]*>Second Album/);
        expect(s).toContain('data:image/png;base64,AAAA');
    });

    it('draws icons only when images are off', () => {
        expect(svg(listStrip({ ...view, showImages: false }))).not.toContain('data:image/png;base64,AAAA');
    });

    it('starts text at the left edge without a picture', () => {
        expect(svg(listStrip({ ...view, position: 3, marked: 3 }))).toMatch(/<text x="10"[^>]*>Plain text row/);
    });

    it('shows placeholders while loading and one sentence when empty', () => {
        expect(svg(listStrip({ ...view, state: 'loading' }))).not.toContain('First Album');
        expect(svg(listStrip({ ...view, state: { message: 'Nothing here' } }))).toContain('Nothing here');
    });

    it('draws the overlay at the top', () => {
        expect(svg(listStrip({ ...view, overlay: { text: 'Library › Albums', alpha: 1 } }))).toContain('Library › Albums');
    });
});

describe('ListController', () => {
    it('redraws while gliding and stops when the list rests', () => {
        const c = clocked();
        const ticker = new FrameTicker(10_000); // never fires on its own; driven by hand below
        let draws = 0;
        const list = new ListController({ id: 'd1', clock: c.clock, ticker, glideMs: 200, redraw: () => draws++ });
        list.reset(5, 0);
        const before = draws;
        list.rotate(1);
        expect(draws).toBeGreaterThan(before);
        expect(ticker.running).toBe(true);
        const out = svg(list.render({ row: (i) => rows[i], accent: '#009FDF' }));
        expect(out).toContain('First Album');
        list.dispose();
        expect(ticker.running).toBe(false);
    });

    it('shows the overlay after reset, then lets it fade', () => {
        const c = clocked();
        const list = new ListController({ id: 'd2', clock: c.clock, ticker: new FrameTicker(10_000), redraw: () => {} });
        list.reset(4, 0, 'Favourites');
        expect(svg(list.render({ row: (i) => rows[i], accent: '#fff' }))).toContain('Favourites');
        c.advance(2000);
        expect(svg(list.render({ row: (i) => rows[i], accent: '#fff' }))).not.toContain('Favourites');
    });
});
