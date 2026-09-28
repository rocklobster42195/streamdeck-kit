import { afterEach, describe, expect, it, vi } from "vitest";
import { LatestSender } from "../src/util/latest-sender.js";

describe("LatestSender", () => {
    afterEach(() => vi.useRealTimers());

    it("sends the first value at once, then only the latest per interval", async () => {
        vi.useFakeTimers();
        const sent: number[] = [];
        const s = new LatestSender<number>(async (v) => void sent.push(v), 100);
        s.push(1);
        s.push(2);
        s.push(3);
        expect(sent).toEqual([1]);
        await vi.advanceTimersByTimeAsync(100);
        expect(sent).toEqual([1, 3]);
        await vi.advanceTimersByTimeAsync(100);
        expect(sent).toEqual([1, 3]);
        s.push(4);
        expect(sent).toEqual([1, 3, 4]);
    });
});
