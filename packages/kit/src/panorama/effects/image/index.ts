// A picture across the whole row: the one you pick (PI file picker) or one from a web address (a
// webcam), scaled to the row and cut into one piece per dial. Three ways it can show:
//   still   the pieces are made once per picture, fit, position and row width (the group ticks slowly)
//   motion  now and then a very slow zoom or pan to a new view (Ken Burns, Fill only), rest in between
//   gif     an animated GIF (up to 60 frames), every frame made into pieces once
// A file's bytes are not in the settings, only a reference (see image-store.ts); a web picture is
// fetched by image-source.ts.
import { composeRow, cropRaw, decodeImage, rawDataUri, sliceDataUri, SLICE_H, SLICE_W, type DecodedImage, type ImageFit } from '../../image-slicer.js';
import { eachGifFrame, isGif } from '../../image-gif.js';
import { makeWork, moveSeconds, motionPhase, placeTile, tileFor, windowFor, type Motion, type Tile } from '../../image-motion.js';
import { setSourceStatus, UrlPictureLoader, type PanoramaUrlSource } from '../../image-source.js';
import { readImage, type PanoramaSource } from '../../image-store.js';
import { kitLog } from '../../../log.js';
import type { EffectDefinition, EffectInstance, PanoramaInitContext } from '../../types.js';

export interface ImageEffectSettings {
    source?: PanoramaSource | PanoramaUrlSource;
    fit?: ImageFit;
    /** Which part stays when Fill cuts the picture, 0-100 (50 = centre). */
    posX?: number;
    posY?: number;
    /** Darken the picture, 0-80 (%). */
    dim?: number;
    /** Ken Burns over a still picture (Fill only; not for a GIF). */
    motion?: Motion;
    /** A slow move to a new view comes about this often (seconds); in between the picture stands still. */
    motionSeconds?: number;
}

const FITS: ImageFit[] = ['fill', 'fit', 'stretch'];
const MOTIONS: Motion[] = ['none', 'zoom', 'pan'];
const MAX_DIM = 80;
const MOTION_TICK_MS = 200;
const GIF_TICK_MS = 100;
const STILL_TICK_MS = 1000;
const DEFAULT_MOTION_SECONDS = 120;

/**
 * Where in its resting time a new motion starts (0..1 of it): random, so rows on several decks, or two
 * instances, do not all move at the same moment. (A test replaces `next`.)
 */
export const motionJitter = { next: (): number => Math.random() };

type Gif = { frames: string[][]; delays: number[]; total: number };

class ImageEffectInstance implements EffectInstance<ImageEffectSettings> {
    private width = SLICE_W;
    private settings: ImageEffectSettings = {};
    /** The pieces showing now, one per dial. */
    private slices: string[] = [];
    /** What the current pieces were made from. */
    private madeFrom = '';
    /** Which picture everything below belongs to (file id or address). */
    private identity = '';
    private decoded: { key: string; image: DecodedImage } | undefined;
    private failedKey: string | undefined;
    private readonly loader = new UrlPictureLoader();
    private seenVersion = -1;
    private gif: Gif | undefined;
    private work: DecodedImage | undefined;
    private motion: Exclude<Motion, 'none'> | undefined;
    /** One fixed piece of the work picture per dial; the motion only moves these. */
    private tiles: { tile: Tile; href: string }[] = [];
    private lastE = NaN;
    private lastEy = NaN;
    private moving = false;
    private soon = false;
    private elapsedMs = 0;
    private readonly jitter = motionJitter.next();
    private jittered = false;

    initPanorama(ctx: PanoramaInitContext<ImageEffectSettings>): void {
        this.width = Math.max(SLICE_W, ctx.width);
        this.settings = ctx.settings;
        this.build();
    }

    onSettingsChange(settings: ImageEffectSettings): void {
        this.settings = settings;
        this.build();
    }

    tickPanorama(dtMs: number): void {
        if (this.settings.source?.kind === 'url') {
            this.loader.tick(dtMs);
            if (this.loader.version !== this.seenVersion) this.build();
        } else if (!this.slices.length && !this.gif) {
            // A picture that is not there yet (still arriving from the PI) is tried again every tick
            this.build();
        }
        if (this.gif) {
            this.elapsedMs += dtMs;
            this.showGifFrame();
        } else if (this.motion && this.tiles.length) {
            this.elapsedMs += dtMs;
            this.showMotionStep();
        }
    }

    /** Still, and a zoom or pan at rest: slowly. A GIF, or a move (about to start): as often as it moves. */
    tickMs(): number {
        if (this.gif && this.gif.frames.length > 1) return GIF_TICK_MS;
        if (this.motion && this.tiles.length && (this.moving || this.soon)) return MOTION_TICK_MS;
        return STILL_TICK_MS;
    }

    renderSlice(offsetX: number, width: number, height: number): string {
        const slice = this.slices[Math.round(offsetX / SLICE_W)];
        if (!slice) return '';
        const dim = Math.max(0, Math.min(MAX_DIM, Number(this.settings.dim ?? 0))) / 100;
        return slice + (dim > 0 ? `<rect width="${width}" height="${height}" fill="#000" opacity="${dim}"/>` : '');
    }

    destroy(): void {
        this.loader.set(undefined);
    }

    private clear(): void {
        this.slices = [];
        this.madeFrom = '';
        this.gif = undefined;
        this.work = undefined;
        this.motion = undefined;
        this.tiles = [];
        this.lastE = NaN;
        this.lastEy = NaN;
        this.moving = false;
        this.soon = false;
        this.elapsedMs = 0;
        this.jittered = false;
    }

    private build(): void {
        const source = this.settings.source;
        const fit = FITS.includes(this.settings.fit as ImageFit) ? (this.settings.fit as ImageFit) : 'fill';
        const identity = source?.kind === 'file' ? `file:${source.id}` : source?.kind === 'url' ? `url:${source.url}|${source.user ?? ''}|${source.password ?? ''}` : '';
        if (identity !== this.identity) {
            // Another picture: what the old one made is not shown any more
            this.identity = identity;
            this.clear();
            this.decoded = undefined;
            this.failedKey = undefined;
            this.seenVersion = -1;
        }
        let key: string;
        let bytes: () => Buffer | undefined;
        if (source?.kind === 'file') {
            key = source.id;
            bytes = () => readImage(source.id);
        } else if (source?.kind === 'url') {
            this.loader.set(source);
            this.loader.tick(0);
            this.seenVersion = this.loader.version;
            key = `url-${this.loader.version}`;
            bytes = () => this.loader.bytes;
        } else {
            this.clear();
            return;
        }
        const posX = Number(this.settings.posX ?? 50);
        const posY = Number(this.settings.posY ?? 50);
        const wanted = MOTIONS.includes(this.settings.motion as Motion) ? (this.settings.motion as Motion) : 'none';
        const motion = wanted !== 'none' && fit === 'fill' ? wanted : undefined;
        const made = `${key}|${fit}|${this.width}|${posX}|${posY}|${motion ?? ''}`;
        if (made === this.madeFrom && (this.slices.length || this.gif)) {
            // Only the speed or darkness changed: nothing to rebuild (a zoom picks up its new cycle by itself)
            return;
        }
        const data = this.decoded?.key === key ? undefined : bytes();
        // A web picture that has not arrived yet (or failed) leaves the last good one standing
        if (!data && this.decoded?.key !== key) return;
        if (data && isGif(data)) {
            this.buildGif(data, key, fit, posX, posY, made);
            return;
        }
        if (this.decoded?.key !== key) {
            if (this.failedKey === key) return;
            const image = decodeImage(data!);
            if (!image) return this.fail(key, source);
            this.decoded = { key, image };
        }
        this.gif = undefined;
        if (motion) {
            this.motion = motion;
            this.work = makeWork(this.decoded.image, this.width, SLICE_H);
            const work = this.work;
            // One fixed piece per dial, big enough for everything the motion will show of it
            this.tiles = Array.from({ length: Math.round(this.width / SLICE_W) }, (_, i) => {
                const tile = tileFor(motion, work, this.width, SLICE_H, i * SLICE_W, SLICE_W, posX, posY);
                return { tile, href: rawDataUri(cropRaw(work, tile.x, tile.y, tile.w, tile.h)) };
            });
            this.lastE = NaN;
            this.lastEy = NaN;
            this.madeFrom = made;
            if (!this.jittered) {
                // Start somewhere in the resting time, so the first move comes after a different wait every time
                const interval = Math.max(30, Number(this.settings.motionSeconds ?? DEFAULT_MOTION_SECONDS));
                this.elapsedMs = this.jitter * (interval - moveSeconds(interval)) * 1000;
                this.jittered = true;
            }
            this.showMotionStep();
            return;
        }
        this.motion = undefined;
        this.work = undefined;
        this.tiles = [];
        const row = composeRow(this.decoded.image, this.width, fit, posX, posY);
        this.slices = this.cut(row);
        this.madeFrom = made;
    }

    private fail(key: string, source: NonNullable<ImageEffectSettings['source']>): void {
        this.failedKey = key;
        kitLog().warn('[panorama] the picture could not be read (JPEG, PNG and GIF only)');
        if (source.kind === 'url') setSourceStatus(source.url, { ok: false, at: Date.now(), code: 'unreadable' });
    }

    private buildGif(data: Buffer, key: string, fit: ImageFit, posX: number, posY: number, made: string): void {
        const frames: string[][] = [];
        const delays: number[] = [];
        const ok = eachGifFrame(data, (frame, delayMs) => {
            frames.push(this.cut(composeRow(frame, this.width, fit, posX, posY)));
            delays.push(delayMs);
        });
        if (!ok || !frames.length) {
            this.failedKey = key;
            kitLog().warn('[panorama] the GIF could not be read');
            return;
        }
        this.motion = undefined;
        this.work = undefined;
        this.tiles = [];
        this.decoded = undefined;
        this.gif = { frames, delays, total: delays.reduce((a, b) => a + b, 0) };
        this.madeFrom = made;
        this.elapsedMs = 0;
        this.showGifFrame();
    }

    private cut(row: Uint8Array): string[] {
        return Array.from({ length: Math.round(this.width / SLICE_W) }, (_, i) => `<image href="${sliceDataUri(row, this.width, i)}" width="${SLICE_W}" height="${SLICE_H}"/>`);
    }

    private showGifFrame(): void {
        const g = this.gif;
        if (!g) return;
        let t = this.elapsedMs % g.total;
        let i = 0;
        while (i < g.delays.length - 1 && t >= g.delays[i]) t -= g.delays[i++];
        this.slices = g.frames[i];
    }

    private showMotionStep(): void {
        if (!this.work || !this.motion || !this.tiles.length) return;
        const interval = Math.max(30, Number(this.settings.motionSeconds ?? DEFAULT_MOTION_SECONDS));
        const ph = motionPhase(this.elapsedMs / 1000, interval);
        this.moving = ph.moving;
        this.soon = ph.soon;
        // At rest nothing changes: the pieces stay as they are
        if (!ph.moving && ph.e === this.lastE && ph.ey === this.lastEy && this.slices.length) return;
        this.lastE = ph.e;
        this.lastEy = ph.ey;
        const win = windowFor(this.motion, ph.e, ph.ey, this.work, this.width, SLICE_H, Number(this.settings.posX ?? 50), Number(this.settings.posY ?? 50));
        this.slices = this.tiles.map(({ tile, href }, i) => {
            const { tx, ty, s } = placeTile(win, tile, this.width, i * SLICE_W);
            return `<image href="${href}" width="${tile.w}" height="${tile.h}" transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})"/>`;
        });
    }
}

const image: EffectDefinition<ImageEffectSettings> = {
    id: 'image',
    rowColor: false,
    displayName: 'Image',
    defaultSettings: { source: { kind: 'none' }, fit: 'fill', posX: 50, posY: 50, dim: 0, motion: 'none', motionSeconds: DEFAULT_MOTION_SECONDS },
    settingsSchema: [
        { key: 'source', type: 'source', label: 'Picture', default: { kind: 'none' } },
        { key: 'dim', type: 'range', label: 'Darken the picture', min: 0, max: MAX_DIM, step: 5, default: 0 },
        {
            key: 'fit',
            type: 'select',
            label: 'Fit',
            options: [
                { label: 'Fill the row (crop the edges)', value: 'fill' },
                { label: 'Fit inside (bars above and below)', value: 'fit' },
                { label: 'Stretch', value: 'stretch' },
            ],
            default: 'fill',
        },
        { key: 'posX', type: 'range', label: 'Left / right (Fill)', min: 0, max: 100, step: 5, default: 50 },
        { key: 'posY', type: 'range', label: 'Up / down (Fill)', min: 0, max: 100, step: 5, default: 50 },
        {
            key: 'motion',
            type: 'select',
            label: 'Motion (Fill, not for GIFs)',
            options: [
                { label: 'Still', value: 'none' },
                { label: 'Slow zoom', value: 'zoom' },
                { label: 'Slow pan', value: 'pan' },
            ],
            default: 'none',
        },
        { key: 'motionSeconds', type: 'range', label: 'Motion: a move every (seconds)', min: 30, max: 600, step: 10, default: DEFAULT_MOTION_SECONDS },
    ],
    // A still picture: no need for 10 frames a second (the instance asks for more when it moves)
    preferredTickMs: STILL_TICK_MS,
    createInstance: () => new ImageEffectInstance(),
};

export default image;
