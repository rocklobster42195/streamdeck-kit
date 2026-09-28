import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlarmTimers, CATCH_UP_MS, RETRY_MS } from "../src/util/alarm-timers.js";

describe("AlarmTimers", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("goes off at the end and reports it", async () => {
        const timers = new AlarmTimers();
        const fire = vi.fn(async () => true);
        const finished = vi.fn();
        timers.onFinished(finished);
        timers.start("a", Date.now() + 60_000, fire);

        await vi.advanceTimersByTimeAsync(59_000);
        expect(fire).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(fire).toHaveBeenCalledOnce();
        expect(finished).toHaveBeenCalledWith("a");
        expect(timers.isRunning("a")).toBe(false);
        expect(timers.hasFinished("a")).toBe(true);
    });

    it("does not go off once cancelled", async () => {
        const timers = new AlarmTimers();
        const fire = vi.fn(async () => true);
        timers.start("a", Date.now() + 1000, fire);
        timers.cancel("a");
        await vi.advanceTimersByTimeAsync(5000);
        expect(fire).not.toHaveBeenCalled();
    });

    it("retries while going off fails, and gives up after the catch-up window", async () => {
        const timers = new AlarmTimers();
        const fire = vi.fn(async () => false);
        timers.start("a", Date.now(), fire);
        await vi.advanceTimersByTimeAsync(0);
        expect(fire).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(RETRY_MS);
        expect(fire).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(CATCH_UP_MS);
        const calls = fire.mock.calls.length;
        expect(timers.hasFinished("a")).toBe(true);
        await vi.advanceTimersByTimeAsync(RETRY_MS * 4);
        expect(fire).toHaveBeenCalledTimes(calls);
    });

    it("catches up on an end in the past only within the window", async () => {
        const timers = new AlarmTimers();
        const recent = vi.fn(async () => true);
        const old = vi.fn(async () => true);
        timers.start("recent", Date.now() - 60_000, recent);
        timers.start("old", Date.now() - CATCH_UP_MS - 1000, old);
        await vi.advanceTimersByTimeAsync(0);
        expect(recent).toHaveBeenCalledOnce();
        expect(old).not.toHaveBeenCalled();
        expect(timers.hasFinished("old")).toBe(true);
    });
});
