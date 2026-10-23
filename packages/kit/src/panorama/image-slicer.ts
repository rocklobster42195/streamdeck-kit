// Turns a picture into what a Panorama row shows: scaled to the row (fill / fit / stretch) and cut into
// one 200 x 100 piece per dial, each as a small JPEG data URI. Pure JavaScript (no native module).
import jpeg from 'jpeg-js';
import { boxResize, decode, type Raw } from '../render/cover-resize.js';

export type ImageFit = 'fill' | 'fit' | 'stretch';
export const SLICE_W = 200;
export const SLICE_H = 100;

export type DecodedImage = Raw;

/** The picture's pixels, or undefined when it is not a JPEG or PNG (or broken). */
export function decodeImage(bytes: Buffer): DecodedImage | undefined {
    return decode(bytes);
}

const clamp = (v: number): number => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 50));

/** A copy of the part `x, y, w, h` of a picture. */
export function cropRaw(src: Raw, x: number, y: number, w: number, h: number): Raw {
    const out = new Uint8Array(w * h * 4);
    const data = src.data as Uint8Array;
    for (let row = 0; row < h; row++) {
        const from = ((y + row) * src.width + x) * 4;
        out.set(data.subarray(from, from + w * 4), row * w * 4);
    }
    return { width: w, height: h, data: out };
}

/** The picture laid onto a `rowW x SLICE_H` canvas, as RGBA. */
/** `posX`/`posY` (0-100, 50 = centred) pick which part of the picture stays when `fill` has to cut it. */
export function composeRow(src: Raw, rowW: number, fit: ImageFit, posX = 50, posY = 50): Uint8Array {
    const rowH = SLICE_H;
    if (fit === 'stretch') return boxResize(src, rowW, rowH);
    if (fit === 'fill') {
        // The part of the picture left after cutting it to the row's shape, centred
        const scale = Math.max(rowW / src.width, rowH / src.height);
        const cw = Math.min(src.width, Math.round(rowW / scale));
        const ch = Math.min(src.height, Math.round(rowH / scale));
        const part = cropRaw(src, Math.floor(((src.width - cw) * clamp(posX)) / 100), Math.floor(((src.height - ch) * clamp(posY)) / 100), cw, ch);
        return boxResize(part, rowW, rowH);
    }
    // Fit: the whole picture, centred, black bars where it does not reach
    const scale = Math.min(rowW / src.width, rowH / src.height);
    const iw = Math.max(1, Math.round(src.width * scale));
    const ih = Math.max(1, Math.round(src.height * scale));
    const inner = boxResize(src, iw, ih);
    const out = new Uint8Array(rowW * rowH * 4);
    for (let i = 3; i < out.length; i += 4) out[i] = 255;
    const ox = Math.floor((rowW - iw) / 2);
    const oy = Math.floor((rowH - ih) / 2);
    for (let y = 0; y < ih; y++) out.set(inner.subarray(y * iw * 4, (y + 1) * iw * 4), ((oy + y) * rowW + ox) * 4);
    return out;
}

/** A picture as a JPEG data URI. */
export function rawDataUri(img: Raw, quality = 88): string {
    const jpg = jpeg.encode({ data: img.data as Uint8Array, width: img.width, height: img.height }, quality).data;
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}

/** Piece number `index` (0 = leftmost dial) of a composed row, as a JPEG data URI. */
export function sliceDataUri(row: Uint8Array, rowW: number, index: number, quality = 85): string {
    const out = new Uint8Array(SLICE_W * SLICE_H * 4);
    for (let y = 0; y < SLICE_H; y++) {
        const from = (y * rowW + index * SLICE_W) * 4;
        out.set(row.subarray(from, from + SLICE_W * 4), y * SLICE_W * 4);
    }
    const jpg = jpeg.encode({ data: out, width: SLICE_W, height: SLICE_H }, quality).data;
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}
