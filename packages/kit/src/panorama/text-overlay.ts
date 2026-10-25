// The text over a Panorama run as every plugin draws it: a change of line or track dissolves the old
// text into the new one over FADE_MS on every display of the run, in step. A plugin that draws the
// run's text without this would cut where its neighbour fades (hardware 2026-10-25: the lyrics changed
// "on time" on Sonos Controller's dial and a fraction later on Music Assistant Controller's).
import { fadeProgress, lyricsOverlay, trackOverlay, type TextRun } from '../render/panorama-text.js';
import type { RunText } from './text-run.js';

type RunState = { shown: RunText; previous?: RunText; changedAt: number };

/** Identity of a text, for noticing a change (a lyrics line or a track). */
const keyOf = (t: RunText): string => (t.kind === 'track' ? `t:${t.title}\n${t.artist}` : `l:${t.current}`);

/**
 * Draws run text with the crossfade and keeps its state per run. `render` takes any run text — a
 * plugin's own or another plugin's from the bus (`TextRunView`).
 */
export class RunTextOverlay {
    private readonly runs = new Map<string, RunState>();

    /**
     * SVG fragment for one display of run `runKey` ('' = no text). `changedAt` is when the text
     * changed (`TextRunView.at`): passing it keeps displays of different plugins at the same point of
     * the fade; without it the fade starts when the change is first seen here.
     */
    render(runKey: string, run: TextRun, text: RunText | undefined, now = Date.now(), changedAt?: number): string {
        if (!text) {
            this.runs.delete(runKey);
            return '';
        }
        const s = this.track(runKey, text, now, changedAt);
        const t = fadeProgress(s.changedAt, now);
        const prev = s.previous?.kind === text.kind ? s.previous : undefined;
        if (text.kind === 'lyrics') return lyricsOverlay(run, text.current, text.next, prev?.kind === 'lyrics' ? prev.current : undefined, t);
        return trackOverlay(run, text, prev?.kind === 'track' ? prev : undefined, t);
    }

    forget(runKey: string): void {
        this.runs.delete(runKey);
    }

    private track(runKey: string, shown: RunText, now: number, changedAt: number | undefined): RunState {
        const s = this.runs.get(runKey);
        if (s && keyOf(s.shown) === keyOf(shown)) return s;
        // A run's displays render the same frame one after another: only the first one sees the change.
        // The first text of a run appears without a fade.
        const at = changedAt !== undefined && changedAt > 0 ? Math.min(changedAt, now) : now;
        const next: RunState = { shown, previous: s?.shown, changedAt: s ? at : 0 };
        this.runs.set(runKey, next);
        return next;
    }
}
