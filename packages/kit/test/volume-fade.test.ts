import { describe, expect, it } from "vitest";
import { computeFadeSteps } from "../src/util/volume-fade.js";

describe("computeFadeSteps", () => {
    it("ramps evenly and lands exactly on the target", () => {
        const steps = computeFadeSteps(20, 0, 10_000);
        expect(steps).toHaveLength(20);
        expect(steps.at(-1)?.volume).toBe(0);
        expect(steps.reduce((sum, s) => sum + s.delayMs, 0)).toBeCloseTo(10_000);
    });
    it("uses fewer, larger steps when the fade is short", () => {
        const steps = computeFadeSteps(40, 0, 1000);
        expect(steps).toHaveLength(4);
        expect(steps.map((s) => s.volume)).toEqual([30, 20, 10, 0]);
    });
    it("does nothing without a distance or a duration", () => {
        expect(computeFadeSteps(0, 0, 5000)).toEqual([]);
        expect(computeFadeSteps(30, 0, 0)).toEqual([]);
    });
});
