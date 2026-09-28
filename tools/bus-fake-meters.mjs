// A fake meter source on deckbus: offers "meters/fake" (stereo, synthetic music with a beat) and
// sends about 20 values a second, but only while someone subscribes. For building audio-reactive
// things without a mixer.
//   node tools/bus-fake-meters.mjs   (build the kit first)
import { DeckBus } from "../packages/kit/dist/bus/index.js";

const bus = new DeckBus({ id: "deckbus-fake-meters", name: "Fake meters", version: "1", caps: ["meters"], scanMs: 1000 });
if (!(await bus.start())) process.exit(1);
bus.setState("status", { online: true });
bus.setState("streams", [{ topic: "meters/fake", label: "Fake music", stereo: true }]);
console.log(`fake meters in slot ${bus.slot}, offering meters/fake`);

const t0 = Date.now();
let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const level = (t, o) => Math.round((20 * Math.log10(0.05 + 0.55 * Math.exp(-(((t / 500) + o) % 1) * 9) + 0.25 * (0.5 + 0.5 * Math.sin(t / 1100 + o)) + 0.08 * rnd()) - 11) * 10) / 10;
let timer;
bus.onSubscribers("meters/fake", (n) => {
    console.log(`${n} subscriber(s)`);
    clearInterval(timer);
    if (n) timer = setInterval(() => {
        const t = Date.now() - t0;
        bus.publish("meters/fake", { l: level(t, 0), r: level(t, 0.013) });
    }, 50);
});
