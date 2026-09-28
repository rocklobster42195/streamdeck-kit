import { describe, expect, it } from "vitest";
import { OptimisticStore } from "../src/util/optimistic.js";

type Q = { state: string; shuffle_enabled: boolean; volume?: number };

describe("OptimisticStore", () => {
    it("patches fields until they expire", () => {
        let now = 1000;
        const store = new OptimisticStore<Q>(() => now);
        const q: Q = { state: "playing", shuffle_enabled: false };

        store.set("q1", { state: "paused" }, 500);
        expect(store.apply("q1", q)).toEqual({ state: "paused", shuffle_enabled: false });
        expect(store.apply("q2", q)).toBe(q);

        now = 1600;
        expect(store.apply("q1", q)).toBe(q);
    });

    it("keeps an independent expiry per field and never mutates the source", () => {
        let now = 0;
        const store = new OptimisticStore<Q>(() => now);
        const q: Q = { state: "playing", shuffle_enabled: false };
        store.set("q", { shuffle_enabled: true }, 1000);
        now = 500;
        store.set("q", { state: "paused" }, 1000);
        now = 1200;
        expect(store.apply("q", q)).toEqual({ state: "paused", shuffle_enabled: false });
        expect(q).toEqual({ state: "playing", shuffle_enabled: false });
    });

    it("drops a patch once the server confirms it, so later outside changes show", () => {
        const store = new OptimisticStore<Q>(() => 0);
        store.set("q", { volume: 6 }, 2000);
        expect(store.apply("q", { state: "x", shuffle_enabled: false, volume: 5 }).volume).toBe(6);
        expect(store.apply("q", { state: "x", shuffle_enabled: false, volume: 6 }).volume).toBe(6);
        // confirmed → gone; a later change from elsewhere is visible right away
        expect(store.apply("q", { state: "x", shuffle_enabled: false, volume: 7 }).volume).toBe(7);
    });

    it("clears single fields or everything", () => {
        const store = new OptimisticStore<Q>(() => 0);
        const q: Q = { state: "idle", shuffle_enabled: false, volume: 10 };
        store.set("q", { state: "playing", volume: 20 }, 1000);
        store.clear("q", ["volume"]);
        expect(store.apply("q", q)).toEqual({ state: "playing", shuffle_enabled: false, volume: 10 });
        store.clear("q");
        expect(store.apply("q", q)).toBe(q);
    });
});
