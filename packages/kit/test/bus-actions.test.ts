import { describe, expect, it, vi } from "vitest";
import { ActionsState, neighbours, type BusAction, type PeerInfo } from "../src/bus/index.js";

const dial = (column: number, extra: Partial<BusAction> = {}): BusAction => ({ device: "D1", column, row: 0, controller: "Encoder", action: "x.dial", ...extra });
const peer = (name: string, actions: unknown): PeerInfo => ({ id: `id.${name}`, name, version: "1", caps: [], slot: 0, protocol: 1, state: { actions } });

describe("ActionsState", () => {
    it("publishes changes together, sorted, and drops removed fields", () => {
        vi.useFakeTimers();
        const setState = vi.fn();
        const state = new ActionsState({ setState }, 100);
        state.set("b", dial(2, { effect: "boing-ball" }));
        state.set("a", dial(1));
        expect(setState).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(setState).toHaveBeenCalledTimes(1);
        expect(setState.mock.calls[0][1].map((a: BusAction) => a.column)).toEqual([1, 2]);

        state.update("b", { effect: undefined });
        state.update("b", { effect: undefined }); // no change: nothing new to send
        state.remove("missing");
        vi.advanceTimersByTime(100);
        expect(setState).toHaveBeenCalledTimes(2);
        expect(setState.mock.calls[1][1][1]).not.toHaveProperty("effect");
        vi.useRealTimers();
    });
});

describe("neighbours", () => {
    it("finds other peers' actions next to a dial on the same device", () => {
        const peers = [peer("XR-C", [dial(0), dial(2, { effect: "particles" }), dial(3), { ...dial(1), device: "D2" }]), peer("Broken", "nonsense")];
        const found = neighbours(peers, dial(1));
        expect(found.map((n) => `${n.peer.name}:${n.side}:${n.action.column}`)).toEqual(["XR-C:left:0", "XR-C:right:2"]);
    });
    it("counts up and down only for keys", () => {
        const key = (column: number, row: number): BusAction => ({ device: "D1", column, row, controller: "Keypad", action: "x.key" });
        const found = neighbours([peer("SA-C", [key(1, 0), key(1, 2), key(2, 2)])], key(1, 1));
        expect(found.map((n) => n.side)).toEqual(["up", "down"]);
    });
});
