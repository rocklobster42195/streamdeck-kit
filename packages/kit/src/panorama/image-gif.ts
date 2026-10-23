// Animated GIFs for the Image effect: read frame by frame (omggif, pure JavaScript), each frame laid
// onto the row like a still picture and kept as the pieces for the dials. A strict limit instead of a
// choppy animation: a GIF with more frames than MAX_FRAMES shows only its first frame.
import omggif from 'omggif';
import type { Raw } from '../render/cover-resize.js';

const { GifReader } = omggif;

export const MAX_GIF_FRAMES = 60;
/** A GIF that says 0 or 1 hundredths per frame is played at 10 fps, as browsers do. */
const MIN_DELAY_MS = 100;
const MAX_PIXELS = 4096 * 4096;

export const isGif = (b: Buffer): boolean => b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;

export type GifInfo = { width: number; height: number; frames: number };

/** Size and number of frames, or undefined when it is not a readable GIF. */
export function gifInfo(bytes: Buffer): GifInfo | undefined {
    try {
        const r = new GifReader(bytes);
        return { width: r.width, height: r.height, frames: r.numFrames() };
    } catch {
        return undefined;
    }
}

/**
 * Calls `onFrame` with each frame as full RGBA picture (the frames of a GIF only hold what changed,
 * so they are put onto a canvas with the GIF's disposal rules) and how long it stays. The canvas is
 * reused: `onFrame` must use the pixels before it returns. Only the first frame when the GIF has
 * more than MAX_GIF_FRAMES. Returns false when the GIF can not be read.
 */
export function eachGifFrame(bytes: Buffer, onFrame: (frame: Raw, delayMs: number) => void): boolean {
    let reader: InstanceType<typeof GifReader>;
    try {
        reader = new GifReader(bytes);
    } catch {
        return false;
    }
    const { width, height } = reader;
    if (width * height > MAX_PIXELS) return false;
    const count = reader.numFrames() > MAX_GIF_FRAMES ? 1 : reader.numFrames();
    const canvas = new Uint8Array(width * height * 4);
    let saved: Uint8Array | undefined;
    let prev: { x: number; y: number; w: number; h: number; disposal: number } | undefined;
    try {
        for (let i = 0; i < count; i++) {
            const info = reader.frameInfo(i);
            // What the previous frame asked for before this one is drawn
            if (prev?.disposal === 2) clear(canvas, width, prev);
            else if (prev?.disposal === 3 && saved) canvas.set(saved);
            saved = info.disposal === 3 ? canvas.slice() : undefined;
            reader.decodeAndBlitFrameRGBA(i, canvas);
            prev = { x: info.x, y: info.y, w: info.width, h: info.height, disposal: info.disposal };
            onFrame({ width, height, data: canvas }, Math.max(MIN_DELAY_MS, (info.delay ?? 0) * 10));
        }
    } catch {
        return false;
    }
    return true;
}

function clear(canvas: Uint8Array, width: number, r: { x: number; y: number; w: number; h: number }): void {
    for (let y = r.y; y < r.y + r.h; y++) canvas.fill(0, (y * width + r.x) * 4, (y * width + r.x + r.w) * 4);
}
