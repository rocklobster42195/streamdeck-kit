import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { CoverResize } from "./cover-cache.js";

/**
 * A resize hook for the cover cache in pure JavaScript (a native module like sharp doesn't ship
 * with a packed plugin): a cover larger than `maxSide` px is brought down to it as a JPEG. Smaller
 * ones, unknown formats and anything that fails to decode are left as served.
 *
 *   configureCoverCache({ resize: coverResizer(256) });
 */
export function coverResizer(maxSide = 256, quality = 82): CoverResize {
    return async (body) => {
        const img = decode(body);
        if (!img || Math.max(img.width, img.height) <= maxSide) return undefined;
        const scale = maxSide / Math.max(img.width, img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const out = jpeg.encode({ data: boxResize(img, w, h), width: w, height: h }, quality).data;
        return { body: out, type: "image/jpeg" };
    };
}

export type Raw = { width: number; height: number; data: ArrayLike<number> };

export function decode(buf: Buffer): Raw | undefined {
    try {
        if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
            const png = PNG.sync.read(buf);
            return { width: png.width, height: png.height, data: png.data };
        }
        if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) {
            const raw = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
            return { width: raw.width, height: raw.height, data: raw.data };
        }
    } catch {
        /* not decodable: keep the original */
    }
    return undefined;
}

/** Box filter: each destination pixel is the mean of the source pixels it covers; transparency goes onto black. */
export function boxResize(src: Raw, dw: number, dh: number): Uint8Array {
    const { width: sw, height: sh, data } = src;
    const out = new Uint8Array(dw * dh * 4);
    for (let dy = 0; dy < dh; dy++) {
        const y0 = Math.floor((dy * sh) / dh);
        const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * sh) / dh));
        for (let dx = 0; dx < dw; dx++) {
            const x0 = Math.floor((dx * sw) / dw);
            const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * sw) / dw));
            let r = 0;
            let g = 0;
            let b = 0;
            let n = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * sw + x) * 4;
                    const a = data[i + 3] / 255;
                    r += data[i] * a;
                    g += data[i + 1] * a;
                    b += data[i + 2] * a;
                    n++;
                }
            }
            const o = (dy * dw + dx) * 4;
            out[o] = r / n;
            out[o + 1] = g / n;
            out[o + 2] = b / n;
            out[o + 3] = 255;
        }
    }
    return out;
}
