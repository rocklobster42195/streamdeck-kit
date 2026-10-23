import { existsSync, mkdtempSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { beforeAll, describe, expect, it } from 'vitest';
import image from '../src/panorama/effects/image/index.js';
import { composeRow, decodeImage, sliceDataUri } from '../src/panorama/image-slicer.js';
import { configurePanoramaStorage, isImageId, readImage, receiveImageChunk, saveImage, sweepImages } from '../src/panorama/image-store.js';
import { listEffects } from '../src/panorama/registry.js';

/** A w x h picture: red on the left to blue on the right. */
function picture(w: number, h: number): Buffer {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i] = Math.round(255 * (1 - x / (w - 1)));
            data[i + 2] = Math.round(255 * (x / (w - 1)));
            data[i + 3] = 255;
        }
    }
    return Buffer.from(jpeg.encode({ data, width: w, height: h }, 95).data);
}

const ID = 'a1b2c3d4e5f60718';

const DIR = mkdtempSync(join(tmpdir(), 'kit-pano-'));
beforeAll(() => configurePanoramaStorage({ dir: DIR }));

describe('picture store', () => {
    it('only accepts ids that cannot leave the folder', () => {
        expect(isImageId(ID)).toBe(true);
        expect(isImageId('../../etc/passwd')).toBe(false);
        expect(saveImage('../x', Buffer.from('a'))).toBe(false);
        expect(readImage('../x')).toBeUndefined();
    });

    it('assembles a picture from chunks, in any order', () => {
        const bytes = picture(64, 32);
        const mid = Math.floor(bytes.length / 2);
        const parts = [bytes.subarray(0, mid), bytes.subarray(mid)];
        const id = 'f00dfeed12345678';
        expect(receiveImageChunk({ id, index: 1, total: 2, data: parts[1].toString('base64') })).toBe(false);
        expect(readImage(id)).toBeUndefined();
        expect(receiveImageChunk({ id, index: 0, total: 2, data: parts[0].toString('base64') })).toBe(true);
        expect(readImage(id)?.equals(bytes)).toBe(true);
    });

    it('refuses chunks with a bad shape', () => {
        expect(receiveImageChunk({ id: ID, index: 5, total: 2, data: 'AA==' })).toBe(false);
        expect(receiveImageChunk({ id: 'nope', index: 0, total: 1, data: 'AA==' })).toBe(false);
    });
});

describe('clean-up', () => {
    const daysAgo = (id: string, days: number) => {
        const t = new Date(Date.now() - days * 86_400_000);
        utimesSync(join(DIR, `${id}.img`), t, t);
    };

    it('deletes pictures nobody refers to and nobody showed for months, and nothing else', () => {
        const [used, old, young, shown] = ['1111111111111111', '2222222222222222', '3333333333333333', '4444444444444444'];
        for (const id of [used, old, young, shown]) saveImage(id, picture(16, 16));
        daysAgo(used, 400);
        daysAgo(old, 120);
        daysAgo(young, 10);
        daysAgo(shown, 200);
        // A picture that is shown is touched by the read, so it counts as young
        readImage(shown);
        sweepImages(new Set([used]));
        expect(existsSync(join(DIR, `${used}.img`))).toBe(true); // referenced
        expect(existsSync(join(DIR, `${old}.img`))).toBe(false); // unreferenced and old
        expect(existsSync(join(DIR, `${young}.img`))).toBe(true); // unreferenced but young
        expect(existsSync(join(DIR, `${shown}.img`))).toBe(true); // was shown
        expect(Date.now() - statSync(join(DIR, `${shown}.img`)).mtimeMs).toBeLessThan(60_000);
    });
});

describe('slicer', () => {
    it('cuts a wide picture into one piece per dial and keeps the left on the left', () => {
        const img = decodeImage(picture(800, 100))!;
        const row = composeRow(img, 800, 'fill');
        expect(row.length).toBe(800 * 100 * 4);
        expect(row[0]).toBeGreaterThan(200); // left edge red
        expect(row[(799) * 4 + 2]).toBeGreaterThan(200); // right edge blue
        const first = sliceDataUri(row, 800, 0);
        const last = sliceDataUri(row, 800, 3);
        expect(first.startsWith('data:image/jpeg;base64,')).toBe(true);
        expect(first).not.toBe(last);
        const px = jpeg.decode(Buffer.from(last.split(',')[1], 'base64'), { useTArray: true });
        expect(px.width).toBe(200);
        expect(px.height).toBe(100);
        expect(px.data[(50 * 200 + 190) * 4 + 2]).toBeGreaterThan(200);
    });

    it('keeps the part of the picture the position asks for when Fill has to cut it', () => {
        // 800 x 100 into a 200 x 100 row: only a quarter of the picture stays
        const img = decodeImage(picture(800, 100))!;
        const left = composeRow(img, 200, 'fill', 0, 50);
        const centre = composeRow(img, 200, 'fill');
        const right = composeRow(img, 200, 'fill', 100, 50);
        expect(left[0]).toBeGreaterThan(200); // red on the left
        expect(right[(199) * 4 + 2]).toBeGreaterThan(200); // blue on the right
        expect(centre[0]).toBeLessThan(left[0]);
        expect(composeRow(img, 200, 'fill', 999, -5).length).toBe(200 * 100 * 4);
    });

    it('fit leaves black bars, stretch fills the row', () => {
        const img = decodeImage(picture(100, 100))!;
        const fit = composeRow(img, 400, 'fit');
        expect(fit[3]).toBe(255);
        expect(fit[0] + fit[1] + fit[2]).toBe(0); // left of the centred square is black
        const stretch = composeRow(img, 400, 'stretch');
        expect(stretch[0]).toBeGreaterThan(200);
    });

    it('does not decode something that is no picture', () => {
        expect(decodeImage(Buffer.from('hello'))).toBeUndefined();
    });
});

describe('image effect', () => {
    it('is listed and has a source field', () => {
        const info = listEffects().find((e) => e.id === 'image')!;
        expect(info.settingsSchema.some((f) => f.type === 'source')).toBe(true);
    });

    it('renders nothing without a picture, then one slice per dial once it is there', () => {
        const effect = image.createInstance();
        const id = '0123456789abcdef';
        const settings = { source: { kind: 'file' as const, id, name: 'x.jpg', w: 800, h: 100 }, fit: 'fill' as const, dim: 0 };
        effect.initPanorama({ width: 600, height: 100, settings });
        expect(effect.renderSlice(0, 200, 100)).toBe('');
        // The picture arrives after the effect started: the next tick picks it up
        saveImage(id, picture(800, 100));
        effect.tickPanorama(1000);
        const a = effect.renderSlice(0, 200, 100);
        const c = effect.renderSlice(400, 200, 100);
        expect(a).toContain('<image href="data:image/jpeg;base64,');
        expect(c).not.toBe(a);
        expect(effect.renderSlice(600, 200, 100)).toBe('');
    });

    it('darkens on request and follows a changed row width', () => {
        const effect = image.createInstance();
        const id = '0123456789abcdef';
        const settings = { source: { kind: 'file' as const, id, name: 'x.jpg', w: 800, h: 100 }, fit: 'fill' as const, dim: 40 };
        effect.initPanorama({ width: 400, height: 100, settings });
        expect(effect.renderSlice(0, 200, 100)).toContain('opacity="0.4"');
        effect.initPanorama({ width: 800, height: 100, settings });
        expect(effect.renderSlice(600, 200, 100)).toContain('<image');
    });
});
