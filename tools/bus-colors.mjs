// Logs when a player's title or colour changes on deckbus, with millisecond timestamps and who
// published it — to see which plugin knows a new cover colour first. Joins as a silent peer.
//   node tools/bus-colors.mjs [seconds]     (build the kit first)
import { DeckBus } from "../packages/kit/dist/bus/index.js";

const seconds = Number(process.argv[2] ?? 300);
const bus = new DeckBus({ id: "deckbus-colors", name: "Colors", version: "1", scanMs: 1000 });
if (!(await bus.start())) process.exit(1);
const t = () => new Date().toISOString().slice(11, 23);
console.log(`${t()} monitor in slot ${bus.slot}, for ${seconds} s`);

const last = new Map();
function look(peers) {
    for (const p of peers) {
        for (const key of ["players", "covers"]) {
            const list = p.state[key];
            if (!Array.isArray(list)) continue;
            for (const e of list) {
                const id = `${p.name}/${key}/${e.player}`;
                const cur = `${e.title ?? ""}|${e.color ?? ""}|${e.playing ? "play" : "stop"}`;
                if (last.get(id) === cur) continue;
                const before = last.get(id);
                last.set(id, cur);
                if (before === undefined) continue; // first sight
                console.log(`${t()} ${p.name} ${key} "${e.name ?? e.player}": title="${e.title ?? ""}" color=${e.color ?? "-"} ${e.playing ? "playing" : "stopped"}`);
            }
        }
    }
}
bus.onPeers(look);
setTimeout(() => process.exit(0), seconds * 1000);
