// Watch deckbus: who is there (name, version, slot, caps), their state, and — with --sub — the
// rate of stream topics. Joins as a silent peer that offers nothing.
//   node tools/bus-monitor.mjs [--sub meters/ch09 …] [--bc alert …]   (build the kit first)
import { DeckBus } from "../packages/kit/dist/bus/index.js";

const args = process.argv.slice(2);
const pick = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
const bus = new DeckBus({ id: "deckbus-monitor", name: "Monitor", version: "1", scanMs: 1000 });
if (!(await bus.start())) process.exit(1);
console.log(`monitor in slot ${bus.slot}`);

bus.onPeers((peers) => {
    console.log(`\n${new Date().toLocaleTimeString()} — ${peers.length} peer(s)`);
    for (const p of peers) console.log(`  [${p.slot}] ${p.name} ${p.version} (${p.id}) caps: ${p.caps.join(", ") || "-"}\n      state: ${JSON.stringify(p.state)}`);
});

const counts = new Map();
for (const topic of pick("--sub")) bus.subscribe(topic, (data, from) => counts.set(topic, { n: (counts.get(topic)?.n ?? 0) + 1, last: data, from: from.name }));
setInterval(() => {
    for (const [topic, c] of counts) console.log(`  ${topic} from ${c.from}: ${c.n}/s, last ${JSON.stringify(c.last)}`);
    counts.clear();
}, 1000);
for (const event of pick("--bc")) bus.onBroadcast(event, (data, from) => console.log(`  broadcast ${event} from ${from.name}: ${JSON.stringify(data)}`));
