import { describe, expect, it } from "vitest";
import { RunTextOverlay, type RunText } from "../src/index.js";

const line = (current: string): RunText => ({ kind: "lyrics", current, next: "" });
const run = { width: 400, offset: 0 };

describe("RunTextOverlay", () => {
    it("shows the first text at once and dissolves a change over the fade", () => {
        const o = new RunTextOverlay();
        const first = o.render("r", run, line("one"), 1000);
        expect(first).toBe(o.render("r", run, line("one"), 1200)); // nothing moves while the text stays
        const at0 = o.render("r", run, line("two"), 2000);
        const mid = o.render("r", run, line("two"), 2200);
        const done = o.render("r", run, line("two"), 2400);
        expect(at0).not.toBe(mid);
        expect(mid).not.toBe(done);
        expect(done).toBe(o.render("r", run, line("two"), 5000));
    });

    it("keeps the displays of two plugins at the same point of the fade when given the change time", () => {
        const a = new RunTextOverlay();
        const b = new RunTextOverlay();
        for (const o of [a, b]) o.render("r", run, line("one"), 1000);
        // the second plugin only sees the change 60 ms later, but knows when it happened
        const left = a.render("r", run, line("two"), 2000, 2000);
        a.render("r", run, line("two"), 2060, 2000);
        const right = b.render("r", run, line("two"), 2060, 2000);
        expect(right).toBe(a.render("r", run, line("two"), 2060, 2000));
        expect(right).not.toBe(left);
    });

    it("draws nothing without text and forgets the run", () => {
        const o = new RunTextOverlay();
        o.render("r", run, line("one"), 1000);
        expect(o.render("r", run, undefined, 1100)).toBe("");
        // a new text after a gap starts without a fade, like the first
        const fresh = o.render("r", run, line("two"), 1200);
        expect(fresh).toBe(o.render("r", run, line("two"), 1300));
    });
});
