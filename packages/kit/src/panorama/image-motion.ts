// Ken Burns for the Image effect: now and then a very slow move to a new view of a still picture, and
// rest in between (not a constant back and forth). The picture is brought once to a "work" size (the
// size that fills the row, 1.3 times as big). Every dial gets one fixed piece of it (a "tile") as a
// picture, and the motion is only a transform of that tile, so a step costs nothing and the picture
// is never re-encoded (no flicker, sub-pixel smooth).
import { boxResize, type Raw } from '../render/cover-resize.js';

export type Motion = 'none' | 'zoom' | 'pan';

/** How far the work picture is larger than what fills the row. */
const WORK = 1.3;
/** The most a zoom goes in, and the zoom a pan runs at. Small on purpose: a hint of motion. */
const ZOOM_MAX = 1.12;
const PAN_ZOOM = 1.08;

export type MotionWindow = { x: number; y: number; w: number; h: number };
export type Tile = { x: number; y: number; w: number; h: number };

/** The picture at work size: what fills a `rowW x rowH` row, times WORK. */
export function makeWork(src: Raw, rowW: number, rowH: number): Raw {
    const scale = Math.max(rowW / src.width, rowH / src.height) * WORK;
    const width = Math.max(1, Math.round(src.width * scale));
    const height = Math.max(1, Math.round(src.height * scale));
    return { width, height, data: boxResize(src, width, height) };
}

/** How long one move takes for a move every `intervalSec`: a quarter of it, between 8 and 40 s. */
export const moveSeconds = (intervalSec: number): number => Math.min(40, Math.max(8, intervalSec * 0.25));

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The shortest way between two resting views (0..1), so a move is always a clear one. */
const MIN_STEP = 0.35;
/** One sequence per axis: the horizontal one starts at the left edge (no zoom), the vertical one in the middle. */
const rests: number[][] = [[0], [0.5]];
/**
 * Where the motion rests in cycle `n` (0..1) on axis 0 (horizontal pan, or how far a zoom goes in) or
 * axis 1 (vertical pan): the start view first, then anywhere at least MIN_STEP away from the one
 * before, to either side (a fixed pseudo-random sequence, so it does not look mechanical).
 */
export function restAt(n: number, axis: 0 | 1 = 0): number {
    const list = rests[axis];
    while (list.length <= n) {
        const prev = list[list.length - 1];
        const below = Math.max(0, prev - MIN_STEP);
        const above = Math.max(0, 1 - (prev + MIN_STEP));
        const x = mulberry32(list.length * 7919 + axis * 104729)() * (below + above);
        list.push(x < below ? x : prev + MIN_STEP + (x - below));
    }
    return list[n];
}

const smooth = (p: number): number => p * p * (3 - 2 * p);

/**
 * The motion at time `tSec`: every `intervalSec` one slow move from the view it rests at to the next
 * one, which takes `moveSeconds(intervalSec)` and comes at the end of the cycle; the rest of the time
 * the picture stands still. `soon`: a move starts within a second and a half (time to tick faster).
 */
export function motionPhase(tSec: number, intervalSec: number): { e: number; ey: number; moving: boolean; soon: boolean } {
    const move = moveSeconds(intervalSec);
    const n = Math.floor(tSec / intervalSec);
    const u = tSec - n * intervalSec;
    const start = intervalSec - move;
    if (u < start) return { e: restAt(n), ey: restAt(n, 1), moving: false, soon: u > start - 1.5 };
    const s = smooth((u - start) / move);
    const at = (axis: 0 | 1) => restAt(n, axis) + (restAt(n + 1, axis) - restAt(n, axis)) * s;
    return { e: at(0), ey: at(1), moving: true, soon: true };
}

/**
 * The part of the work picture to look at. A zoom goes `e` (0..1) of the way in, anchored at `posX`/`posY`
 * (0-100). A pan looks at `e` of the way across and `ey` of the way down (a wide picture has hardly
 * any room to move down, a tall one a lot).
 */
export function windowFor(motion: Exclude<Motion, 'none'>, e: number, ey: number, work: Raw, rowW: number, rowH: number, posX: number, posY: number): MotionWindow {
    const k = motion === 'zoom' ? 1 + (ZOOM_MAX - 1) * e : PAN_ZOOM;
    const w = Math.min(work.width, (rowW * WORK) / k);
    const h = Math.min(work.height, (rowH * WORK) / k);
    const fx = motion === 'pan' ? e : clamp(posX) / 100;
    const fy = motion === 'pan' ? ey : clamp(posY) / 100;
    return { x: (work.width - w) * fx, y: (work.height - h) * fy, w, h };
}

const clamp = (v: number): number => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 50));

/** The part of the work picture the dial at row offset `ox` can show at any moment of the motion (a little more). */
export function tileFor(motion: Exclude<Motion, 'none'>, work: Raw, rowW: number, rowH: number, ox: number, dialW: number, posX: number, posY: number): Tile {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    // Every position the motion can reach: along the zoom, or over the whole area of a pan
    for (let i = 0; i <= 40; i++) {
        for (let j = 0; j <= (motion === 'pan' ? 8 : 0); j++) {
            const win = windowFor(motion, i / 40, j / 8, work, rowW, rowH, posX, posY);
            const s = rowW / win.w;
            x0 = Math.min(x0, win.x + ox / s);
            x1 = Math.max(x1, win.x + (ox + dialW) / s);
            y0 = Math.min(y0, win.y);
            y1 = Math.max(y1, win.y + rowH / s);
        }
    }
    const x = Math.max(0, Math.floor(x0) - 2);
    const y = Math.max(0, Math.floor(y0) - 2);
    return { x, y, w: Math.min(work.width, Math.ceil(x1) + 2) - x, h: Math.min(work.height, Math.ceil(y1) + 2) - y };
}

/** Where the tile goes for this window: scale and offset inside the dial (`ox`: the dial's offset in the row). */
export function placeTile(win: MotionWindow, tile: Tile, rowW: number, ox: number): { tx: number; ty: number; s: number } {
    const s = rowW / win.w;
    return { tx: (tile.x - win.x) * s - ox, ty: (tile.y - win.y) * s, s };
}
