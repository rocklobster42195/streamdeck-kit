import { describe, expect, it, vi } from "vitest";
import { TextRuns, type BusAction, type PeerInfo, type RunText } from "../src/index.js";

const dial = (column: number, extra: Partial<BusAction> = {}): BusAction => ({ device: "D1", column, row: 0, controller: "Encoder", action: "x.pano", canvas: true, ...extra });
const peer = (name: string, actions: BusAction[]): PeerInfo => ({ id: `id.${name}`, name, version: "1", caps: [], slot: 0, protocol: 1, state: { actions } });
const track: RunText = { kind: "track", title: "Silence", artist: "Delerium" };

function bus() {
    let cb: (peers: PeerInfo[]) => void = () => {};
    return { onPeers: (fn: (peers: PeerInfo[]) => void) => ((cb = fn), () => {}), emit: (peers: PeerInfo[]) => cb(peers) };
}

describe("TextRuns", () => {
    it("takes text over the plugin border: a title from the neighbour's dial spans both", () => {
        const b = bus();
        const update = vi.fn();
        const runs = new TextRuns({ update });
        runs.connect(b);
        const redraw = vi.fn();
        runs.set("mine", { device: "D1", column: 2 }, track, redraw);
        // the other plugin's canvas dial sits left of it, shows no text
        b.emit([peer("MA-C", [dial(1)])]);
        const view = runs.run("mine")!;
        expect(view).toMatchObject({ width: 400, offset: 200, index: 1, length: 2, local: true, text: track });
        expect(update).toHaveBeenCalledWith("mine", { canvas: true, text: track, textAt: expect.any(Number) });
    });

    it("lets the dial whose text changed last decide, from whichever plugin; ties go left", () => {
        const b = bus();
        const runs = new TextRuns();
        runs.connect(b);
        runs.set("mine", { device: "D1", column: 2 }, { kind: "track", title: "Mine", artist: "" }, () => {});
        const lyrics: RunText = { kind: "lyrics", current: "la la", next: "" };
        // the neighbour changed its text later than mine: it decides
        b.emit([peer("MA-C", [dial(1, { text: lyrics, textAt: Date.now() + 5000 })])]);
        expect(runs.run("mine")).toMatchObject({ local: false, text: lyrics, offset: 200 });
        // an older text of the neighbour (e.g. Music Assistant lagging behind) loses to mine
        b.emit([peer("MA-C", [dial(1, { text: lyrics, textAt: 1 })])]);
        expect(runs.run("mine")).toMatchObject({ local: true, text: { kind: "track", title: "Mine" } });
        // no time given: the leftmost
        b.emit([peer("MA-C", [dial(1, { text: lyrics })])]);
        expect(runs.run("mine")).toMatchObject({ local: true });
    });

    it("breaks the run at a dial that isn't a canvas, or sits on another device", () => {
        const b = bus();
        const runs = new TextRuns();
        runs.connect(b);
        runs.set("mine", { device: "D1", column: 2 }, track, () => {});
        b.emit([peer("XR-C", [{ ...dial(1), canvas: undefined }, { ...dial(3), device: "D2" }])]);
        expect(runs.run("mine")).toMatchObject({ width: 200, offset: 0, length: 1 });
    });

    it("asks a dial to redraw when a neighbour's text changes, not otherwise", () => {
        const b = bus();
        const runs = new TextRuns();
        runs.connect(b);
        const redraw = vi.fn();
        runs.set("mine", { device: "D1", column: 2 }, undefined, redraw);
        b.emit([peer("MA-C", [dial(1, { text: track })])]);
        const calls = redraw.mock.calls.length;
        b.emit([peer("MA-C", [dial(1, { text: track })])]);
        expect(redraw.mock.calls.length).toBe(calls);
        b.emit([peer("MA-C", [dial(1, { text: { ...track, title: "Other" } })])]);
        expect(redraw.mock.calls.length).toBe(calls + 1);
        expect(runs.run("mine")?.text).toMatchObject({ title: "Other" });
    });

    it("forgets a removed dial", () => {
        const runs = new TextRuns();
        runs.set("a", { device: "D1", column: 1 }, track, () => {});
        runs.remove("a");
        expect(runs.run("a")).toBeUndefined();
    });
});
