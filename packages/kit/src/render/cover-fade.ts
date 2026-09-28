import { getCachedCover, loadCover } from "./cover-cache.js";
import { frames } from "./frames.js";

/** Crossfade duration between two covers (sonos-controller: 10 steps of 80 ms). */
const FADE_MS = 800;

export type CoverFrame = {
    /** The cover to show (fully visible once the fade is done). */
    cover?: string;
    /** The cover being faded out, only while a fade runs. */
    previous?: string;
    /** 0..1 opacity of `cover` over `previous`. */
    mix: number;
};

type State = { url: string; cover: string; previous?: string; since: number };

/**
 * Per-instance cover state, as on sonos-controller's play/pause key: while the next cover loads
 * the key keeps showing the last one (instead of dropping to an icon), and once it's there the
 * two crossfade. With `fadeMs` 0 it only holds the last cover (strips don't blend).
 */
export class CoverFader {
    private readonly state = new Map<string, State>();

    constructor(private readonly fadeMs = FADE_MS) {}

    /** `startMix`: a new cover starts its fade this far in (it was already faded in by a prediction). */
    frame(id: string, url: string | undefined, redraw: () => void, startMix = 0): CoverFrame {
        if (!url) {
            this.forget(id);
            return { mix: 1 };
        }
        const s = this.state.get(id);
        const hit = getCachedCover(url);
        if (!hit) {
            void loadCover(url).then((c) => c && redraw());
            return s ? this.current(s) : { mix: 1 };
        }
        if (!s) {
            this.state.set(id, { url, cover: hit, since: 0 });
            return { cover: hit, mix: 1 };
        }
        if (s.url !== url) {
            // Mid-fade the new cover fades in from whatever was the target so far.
            s.previous = this.fadeMs > 0 ? s.cover : undefined;
            s.url = url;
            s.cover = hit;
            s.since = Date.now() - Math.min(1, Math.max(0, startMix)) * this.fadeMs;
            if (s.previous) {
                frames.run(`cover-${id}`, () => {
                    if (this.state.get(id) !== s || !s.previous) return false;
                    redraw();
                    return Date.now() - s.since < this.fadeMs;
                });
            }
        }
        return this.current(s);
    }

    forget(id: string): void {
        this.state.delete(id);
        frames.stop(`cover-${id}`);
    }

    private current(s: State): CoverFrame {
        if (!s.previous) return { cover: s.cover, mix: 1 };
        const t = Math.min(1, (Date.now() - s.since) / this.fadeMs);
        if (t >= 1) {
            s.previous = undefined;
            return { cover: s.cover, mix: 1 };
        }
        return { cover: s.cover, previous: s.previous, mix: t * t * (3 - 2 * t) }; // smoothstep
    }
}
