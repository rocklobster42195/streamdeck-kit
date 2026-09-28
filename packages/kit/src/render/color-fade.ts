import { frames } from "./frames.js";

type Rgb = [number, number, number];
type State = { from: Rgb; to: Rgb; since: number };

/** Length of a color change (e.g. a ring following the cover color to the next track). */
const FADE_MS = 700;

/**
 * Per-instance color that glides from one cover color to the next instead of jumping. While the
 * next track's palette isn't known yet (between tracks), the last color stays — before this, the
 * ring flashed the fallback blue for a moment on every track change.
 */
export class ColorFader {
    private readonly state = new Map<string, State>();

    /** The color to draw now for `target` (undefined = keep the last one; fallback when there never was one). */
    color(id: string, target: Rgb | undefined, fallback: string, redraw: () => void): string {
        const s = this.state.get(id);
        if (!target) return s ? css(this.current(s)) : fallback;
        if (!s) {
            this.state.set(id, { from: target, to: target, since: 0 });
            return css(target);
        }
        if (!same(s.to, target)) {
            s.from = this.current(s);
            s.to = target;
            s.since = Date.now();
            frames.run(`color-${id}`, () => {
                if (this.state.get(id) !== s) return false;
                redraw();
                return Date.now() - s.since < FADE_MS;
            });
        }
        return css(this.current(s));
    }

    forget(id: string): void {
        this.state.delete(id);
        frames.stop(`color-${id}`);
    }

    private current(s: State): Rgb {
        const t = Math.min(1, (Date.now() - s.since) / FADE_MS);
        const e = t * t * (3 - 2 * t);
        return [0, 1, 2].map((i) => Math.round(s.from[i] + (s.to[i] - s.from[i]) * e)) as Rgb;
    }
}

const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const css = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`;
