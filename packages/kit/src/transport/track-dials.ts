// The universal Track dial (grill 2026-10-10, without lyrics: those belong in the Panorama): cover,
// title, artist and progress of any player on the deck; rotate seeks (seconds per tick), push
// skips to the next track, a tap plays or pauses. A turned seek and a tapped play/pause show at once
// until the player confirms. Title and artist scroll in counted steps; the Equalizer look moves
// while it plays. SDK-free.
import { CoverFader } from '../render/cover-fade.js';
import { frames } from '../render/frames.js';
import { MarqueeStepper, marqueeNeeded, marqueeSvg } from '../render/marquee.js';
import { measureArialWidth } from '../render/text-width.js';
import { renderTrackDial, type TrackDialLook } from '../render/track-dial.js';
import { ACTIVE_PLAYER, positionNow, type Player, type PlayerBoard } from '../players/players.js';
import { KEY_GREY, resolveKeyColor } from '../players/key-color.js';
import { LatestSender } from '../util/latest-sender.js';

export type TrackDialSettings = {
    player?: string;
    look?: TrackDialLook;
    coverSide?: 'left' | 'right';
    /** Seconds per tick when seeking (default 10). */
    seekStep?: number | string;
    showTitle?: boolean;
    /** The progress bar's colour: "cover" (default), "grey", "row" or "#RRGGBB". */
    keyColor?: string;
};

const HOLD_MS = 4000;
const TEXT_W = 84;
const ARTIST_DELAY_TICKS = 5;
const BASE_BARS = [8, 14, 10, 18, 6, 12, 16, 8, 14, 10];
const EQ_FADE_S = 3;

export type TrackDialsOptions = {
    board: Pick<PlayerBoard, 'resolve' | 'send' | 'onChange'>;
    draw: (id: string, image: string) => void;
    defaultPlayer?: string;
    rowColor?: (id: string) => string | undefined;
    /** A small badge for the cover's corner (a round source icon, the battery), drawn by the plugin. */
    badge?: (id: string, p: Player) => string | undefined;
    /** The Panorama slice behind a dial, or nothing. */
    underlay?: (id: string) => string | undefined;
    nothingLabel: () => string;
    onError?: (e: unknown) => void;
    now?: () => number;
};

type Marquee = { key: string; title: MarqueeStepper; artist: MarqueeStepper; artistDelay: number };
type Dial = {
    settings: TrackDialSettings;
    pressed?: { position?: number; playing?: boolean; until: number };
    seeker?: LatestSender<number>;
    marquee?: Marquee;
    bars?: { h: number[]; target: number[]; next: number[] };
    last?: string;
};

export class TrackDials {
    private readonly dials = new Map<string, Dial>();
    private readonly covers = new CoverFader(0);
    private readonly off: () => void;
    private readonly now: () => number;
    private ticker: ReturnType<typeof setInterval> | undefined;

    constructor(private readonly o: TrackDialsOptions) {
        this.now = o.now ?? Date.now;
        this.off = o.board.onChange(() => this.renderAll());
    }

    show(id: string, settings: TrackDialSettings): void {
        const d = this.dials.get(id);
        if (d) {
            d.settings = settings;
            d.last = undefined;
        } else this.dials.set(id, { settings });
        // The progress moves between the players' reports: draw once a second (unchanged pictures aren't re-sent)
        if (!this.ticker) {
            this.ticker = setInterval(() => this.renderAll(), 1000);
            this.ticker.unref?.();
        }
        this.render(id);
    }

    hide(id: string): void {
        this.dials.delete(id);
        this.covers.forget(id);
        frames.stop(`track-dial-${id}`);
        if (!this.dials.size && this.ticker) {
            clearInterval(this.ticker);
            this.ticker = undefined;
        }
    }

    redraw(id: string): void {
        this.render(id);
    }

    player(id: string): Player | undefined {
        const d = this.dials.get(id);
        return d ? this.o.board.resolve(d.settings.player || this.o.defaultPlayer || ACTIVE_PLAYER) : undefined;
    }

    /** Rotate: seek by `ticks` x the step (not on live streams or players that can't seek). */
    rotate(id: string, ticks: number): void {
        const d = this.dials.get(id);
        const p = this.player(id);
        if (!d || !p || !p.duration || (p.can && !p.can.includes('seek'))) return;
        const current = this.shownPosition(d, p);
        const step = stepOf(d.settings);
        const target = Math.round(Math.min(p.duration - 1, Math.max(0, current + ticks * step)));
        d.pressed = { ...d.pressed, position: target, until: this.now() + HOLD_MS };
        this.render(id);
        if (!d.seeker) {
            d.seeker = new LatestSender<number>(
                (v) => {
                    const pl = this.player(id);
                    return pl ? this.o.board.send(pl, 'seek', v) : Promise.resolve();
                },
                250,
                (e) => this.o.onError?.(e),
            );
        }
        d.seeker.push(target);
    }

    /** Push: the next track. */
    async next(id: string): Promise<void> {
        const p = this.player(id);
        if (!p) throw new Error('track: no player');
        if (p.can && !p.can.includes('next')) throw new Error(`track: ${p.name} can't skip`);
        await this.o.board.send(p, 'next');
    }

    /** A tap: play or pause, from what the player is doing (explicit, never a toggle). */
    async playPause(id: string): Promise<void> {
        const d = this.dials.get(id);
        const p = this.player(id);
        if (!d || !p) throw new Error('track: no player');
        const playing = this.shownPlaying(d, p);
        d.pressed = { ...d.pressed, playing: !playing, position: playing ? this.shownPosition(d, p) : d.pressed?.position, until: this.now() + HOLD_MS };
        this.render(id);
        try {
            await this.o.board.send(p, playing ? 'pause' : 'play');
        } catch (e) {
            d.pressed = undefined;
            this.render(id);
            throw e;
        }
    }

    dispose(): void {
        this.off();
        if (this.ticker) clearInterval(this.ticker);
        for (const id of this.dials.keys()) frames.stop(`track-dial-${id}`);
        this.dials.clear();
    }

    private shownPlaying(d: Dial, p: Player): boolean {
        const pr = d.pressed;
        if (pr?.playing !== undefined) {
            if (this.now() <= pr.until && pr.playing !== p.playing) return pr.playing;
            d.pressed = { ...pr, playing: undefined };
        }
        return p.playing;
    }

    private shownPosition(d: Dial, p: Player): number {
        const actual = positionNow(p, this.now()) ?? 0;
        const pr = d.pressed;
        if (pr?.position !== undefined) {
            // Until the player's position has caught up (within 2 s of what was asked), or time ran out
            if (this.now() > pr.until || Math.abs(actual - pr.position) <= 2) d.pressed = { ...pr, position: undefined };
            else return pr.position;
        }
        return actual;
    }

    private renderAll(): void {
        for (const id of this.dials.keys()) this.render(id);
    }

    private marquee(d: Dial, key: string): Marquee {
        if (d.marquee?.key === key) return d.marquee;
        d.marquee = { key, title: new MarqueeStepper(25), artist: new MarqueeStepper(25), artistDelay: ARTIST_DELAY_TICKS };
        return d.marquee;
    }

    private render(id: string): void {
        const d = this.dials.get(id);
        if (!d) return;
        const p = this.player(id);
        const s = d.settings;
        const underlay = this.o.underlay?.(id);
        if (!p) {
            this.draw(id, d, renderTrackDial({ playing: false, accent: KEY_GREY, nothing: this.o.nothingLabel(), coverSide: s.coverSide, underlay }));
            return;
        }
        const playing = this.shownPlaying(d, p);
        const pos = this.shownPosition(d, p);
        const live = !p.duration;
        const accent = s.keyColor === 'grey' ? KEY_GREY : resolveKeyColor(s.keyColor ?? 'cover', { cover: p.color, row: this.o.rowColor?.(id) });
        const cover = this.covers.frame(id, p.cover, () => this.render(id)).cover;
        const title = p.title ?? '';
        const artist = p.artist ?? p.album ?? '';
        const look: TrackDialLook = s.look ?? 'info';
        const eq = look === 'eq' && !underlay;

        // Scrolling text in counted steps while it doesn't fit
        const m = this.marquee(d, `${title}\n${artist}`);
        const titleY = 72;
        const artistY = 86;
        const artistSize = 11;
        const x = s.coverSide === 'left' ? 108 : 8;
        const titleScrolls = !!title && marqueeNeeded(title, 14, TEXT_W);
        const artistScrolls = !!artist && marqueeNeeded(artist, artistSize, TEXT_W);
        const titleSvg = titleScrolls ? marqueeSvg({ id: `t${id}`, text: title, x, y: titleY, width: TEXT_W, fontSize: 14, startedAt: 0, now: 0, offset: m.title.offset(measureArialWidth(title, 14)) }) : undefined;
        const artistSvg = artistScrolls
            ? marqueeSvg({ id: `a${id}`, text: artist, x, y: artistY, width: TEXT_W, fontSize: artistSize, color: '#999999', startedAt: 0, now: 0, offset: m.artist.offset(measureArialWidth(artist, artistSize)) })
            : undefined;
        if (titleScrolls || artistScrolls || (eq && playing)) {
            frames.run(`track-dial-${id}`, () => {
                const cur = this.dials.get(id);
                if (!cur || cur.marquee !== m) return false;
                if (titleScrolls || artistScrolls) {
                    m.title.tick();
                    if (m.artistDelay > 0) m.artistDelay--;
                    else m.artist.tick();
                }
                this.render(id);
                return true;
            });
        } else frames.stop(`track-dial-${id}`);

        const remaining = p.duration ? p.duration - pos : Infinity;
        this.draw(
            id,
            d,
            renderTrackDial({
                title,
                artist,
                cover,
                playing,
                live,
                progress: live ? undefined : pos / p.duration!,
                accent,
                coverSide: s.coverSide,
                look,
                titleSvg,
                artistSvg,
                bars: eq && playing ? this.eqBars(d) : undefined,
                amplitude: playing && remaining < EQ_FADE_S ? Math.max(0, remaining / EQ_FADE_S) : 1,
                badge: this.o.badge?.(id, p),
                underlay,
                nothing: this.o.nothingLabel(),
                showTitle: s.showTitle,
            }),
        );
    }

    /** Bars drifting to new heights a few times a second (as Sonos Controller's equalizer). */
    private eqBars(d: Dial): number[] {
        const t = this.now();
        const b = (d.bars ??= { h: [...BASE_BARS], target: [...BASE_BARS], next: BASE_BARS.map(() => 0) });
        return BASE_BARS.map((base, i) => {
            if (t >= b.next[i]) {
                b.target[i] = Math.max(4, Math.min(18, base + Math.random() * 10 - 5));
                b.next[i] = t + 120 + Math.random() * 130;
            }
            b.h[i] += (b.target[i] - b.h[i]) * 0.45;
            return b.h[i];
        });
    }

    private draw(id: string, d: Dial, image: string): void {
        if (image === d.last) return;
        d.last = image;
        this.o.draw(id, image);
    }
}

function stepOf(s: TrackDialSettings): number {
    const n = Number(s.seekStep);
    return s.seekStep === undefined || s.seekStep === '' || !Number.isFinite(n) ? 10 : Math.min(60, Math.max(1, Math.round(n)));
}
