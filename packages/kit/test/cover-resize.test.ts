import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import { coverResizer } from '../src/render/cover-resize.js';

function image(w: number, h: number): Buffer {
    const data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i] = (x * 255) / w;
            data[i + 1] = (y * 255) / h;
            data[i + 2] = 128;
            data[i + 3] = 255;
        }
    return Buffer.from(jpeg.encode({ data, width: w, height: h }, 95).data);
}

describe('coverResizer', () => {
    it('brings a large cover down to the longest side, smaller in bytes, as a JPEG', async () => {
        const big = image(600, 400);
        const out = await coverResizer(256)(big, 'image/jpeg');
        expect(out?.type).toBe('image/jpeg');
        const back = jpeg.decode(out!.body, { useTArray: true });
        expect([back.width, back.height]).toEqual([256, 171]);
        expect(out!.body.length).toBeLessThan(big.length);
    });

    it('leaves small covers, and what it cannot read, as served', async () => {
        expect(await coverResizer(256)(image(200, 200), 'image/jpeg')).toBeUndefined();
        expect(await coverResizer(256)(Buffer.from('not an image'), 'image/jpeg')).toBeUndefined();
    });
});
