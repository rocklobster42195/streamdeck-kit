import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cached = new Map<string, string>();
vi.mock("../src/render/cover-cache.js", () => ({
    getCachedCover: (url: string) => cached.get(url),
    loadCover: () => Promise.resolve(undefined),
}));
vi.mock("../src/render/frames.js", () => ({ frames: { run: vi.fn(), stop: vi.fn() } }));

const { CoverFader } = await import("../src/render/cover-fade.js");

describe("CoverFader", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        cached.clear();
    });
    afterEach(() => vi.useRealTimers());

    it("keeps the last cover while the next one is still loading", () => {
        const f = new CoverFader();
        cached.set("a", "A");
        expect(f.frame("k", "a", () => {}).cover).toBe("A");
        const next = f.frame("k", "b", () => {}); // "b" not cached yet
        expect(next.cover).toBe("A");
        expect(next.previous).toBeUndefined();
    });

    it("crossfades to a new cover once it's there, then settles", () => {
        const f = new CoverFader(800);
        cached.set("a", "A");
        cached.set("b", "B");
        f.frame("k", "a", () => {});
        const start = f.frame("k", "b", () => {});
        expect(start).toMatchObject({ cover: "B", previous: "A" });
        expect(start.mix).toBeCloseTo(0);
        vi.advanceTimersByTime(400);
        const mid = f.frame("k", "b", () => {});
        expect(mid.previous).toBe("A");
        expect(mid.mix).toBeCloseTo(0.5);
        vi.advanceTimersByTime(400);
        expect(f.frame("k", "b", () => {})).toEqual({ cover: "B", mix: 1 });
    });

    it("drops the cover when the media has none, and only holds without fading when fadeMs is 0", () => {
        const f = new CoverFader(0);
        cached.set("a", "A");
        cached.set("b", "B");
        f.frame("k", "a", () => {});
        expect(f.frame("k", "b", () => {})).toEqual({ cover: "B", mix: 1 });
        expect(f.frame("k", undefined, () => {})).toEqual({ mix: 1 });
    });
});
