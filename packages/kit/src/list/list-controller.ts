// Wiring of a dial list: the scroll model, the strip layout and the shared frame ticker. The plugin
// keeps its own dial action and data; it calls rotate()/reset() and draws with render(), and
// answers push/touch itself (`marked` is the selected row).
import type { FrameTicker } from '../render/animation.js';
import { frames as sharedFrames } from '../render/frames.js';
import { marqueeNeeded } from '../render/marquee.js';
import { listStrip, listTitleWidth, type ListStripView } from './list-strip.js';
import { ScrollList, type ScrollListOptions } from './scroll-list.js';

export type ListControllerOptions = ScrollListOptions & {
    /** Unique per dial (ticker and marquee ids). */
    id: string;
    /** Draw the dial again (the plugin's render, which calls render() here). */
    redraw: () => void;
    ticker?: FrameTicker;
    /** Marker crossfade (ms). */
    markerFadeMs?: number;
    /** How long the overlay (breadcrumb) stays, and its fade-out (ms). */
    overlayMs?: number;
    overlayFadeMs?: number;
};

/** What render() takes: the strip view without the parts the controller owns. */
export type ListRenderView = Omit<ListStripView, 'count' | 'position' | 'marked' | 'markerAlpha' | 'previousMarked' | 'overlay' | 'marquee'>;

export class ListController {
    readonly model: ScrollList;
    private readonly ticker: FrameTicker;
    private readonly clock: () => number;
    private lastMarked = -1;
    private previousMarked = -1;
    private markedAt = 0;
    private restSince = 0;
    private overlay?: { text: string; at: number };
    private marqueeOn = false;

    constructor(private readonly o: ListControllerOptions) {
        this.model = new ScrollList(o);
        this.ticker = o.ticker ?? sharedFrames;
        this.clock = o.clock ?? Date.now;
    }

    get marked(): number {
        return this.model.marked;
    }

    get length(): number {
        return this.model.length;
    }

    /**
     * New content (e.g. a level opened): jump to `index`; `overlay` shows briefly at the top. Safe to
     * call from inside the plugin's render (it doesn't redraw synchronously).
     */
    reset(length: number, index = 0, overlay?: string): void {
        this.model.reset(length, index);
        this.lastMarked = this.previousMarked = -1;
        this.restSince = this.clock();
        this.overlay = overlay ? { text: overlay, at: this.clock() } : undefined;
        this.animate(false);
    }

    setLength(length: number): void {
        this.model.setLength(length);
    }

    rotate(ticks: number): void {
        if (this.model.rotate(ticks)) this.animate();
    }

    moveTo(index: number): void {
        this.model.moveTo(index);
        this.animate();
    }

    render(view: ListRenderView): string {
        const now = this.clock();
        const marked = this.model.marked;
        if (marked !== this.lastMarked) {
            this.previousMarked = this.lastMarked;
            this.lastMarked = marked;
            this.markedAt = this.previousMarked < 0 ? 0 : now;
        }
        const moving = this.model.moving;
        if (moving) this.restSince = 0;
        else if (!this.restSince) this.restSince = now;

        const fadeMs = this.o.markerFadeMs ?? 160;
        const markerAlpha = this.markedAt ? Math.min(1, (now - this.markedAt) / fadeMs) : 1;

        const row = view.state ? undefined : view.row(marked);
        this.marqueeOn = !moving && !!row?.subtitle && marqueeNeeded(row.title, 13, listTitleWidth(row, view.showImages));

        return listStrip({
            ...view,
            count: this.model.length,
            position: this.model.position,
            marked,
            markerAlpha,
            previousMarked: markerAlpha < 1 ? this.previousMarked : undefined,
            overlay: this.overlayNow(now),
            marquee: this.marqueeOn ? { id: this.o.id, startedAt: this.restSince, now } : undefined,
        });
    }

    /** Stop redrawing (the dial disappeared). */
    dispose(): void {
        this.ticker.stop(this.tickerId);
    }

    private get tickerId(): string {
        return `list-${this.o.id}`;
    }

    private overlayNow(now: number): { text: string; alpha: number } | undefined {
        if (!this.overlay) return undefined;
        const stay = this.o.overlayMs ?? 1500;
        const fade = this.o.overlayFadeMs ?? 300;
        const t = now - this.overlay.at;
        if (t >= stay + fade) {
            this.overlay = undefined;
            return undefined;
        }
        return { text: this.overlay.text, alpha: t <= stay ? 1 : 1 - (t - stay) / fade };
    }

    private busy(): boolean {
        const fading = !!this.markedAt && this.clock() - this.markedAt < (this.o.markerFadeMs ?? 160);
        return this.model.moving || fading || !!this.overlay || this.marqueeOn;
    }

    private animate(now = true): void {
        if (now) this.o.redraw();
        this.ticker.run(this.tickerId, () => {
            this.o.redraw();
            return this.busy();
        });
    }
}
