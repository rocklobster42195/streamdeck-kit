# @rocklobster42195/streamdeck-kit

Building blocks for [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugins written against the official [`@elgato/streamdeck`](https://www.npmjs.com/package/@elgato/streamdeck) SDK:

- **Rendering helpers** for keys and Stream Deck + touch strips: exact Arial text widths, truncation and wrapping by measured width, a marquee, a title fader and a PNG encoder.
- **Animation:** a shared frame ticker that runs only while something moves, plus eased values.
- **Panorama effects:** animated backgrounds that span several neighbouring dials.
- **A property inspector kit:** a framework-free replacement for `sdpi-components`, with a Stream Deck socket client, i18n, light-DOM components and a dark theme.

It is used by [MA-C (Music Assistant Controller)](https://github.com/rocklobster42195/streamdeck-music-assistant-controller) and will be used by [Sonos Controller](https://github.com/rocklobster42195/streamdeck-sonos-controller) and the plugins that follow them.

> **Status: early (0.x).** The API follows what these plugins need and may still change between minor versions.

This is an unofficial community package. It is not affiliated with or endorsed by Elgato or Corsair.

## Install

```sh
npm install @rocklobster42195/streamdeck-kit
```

Node 20 or later (the Stream Deck plugin runtime). The package is ESM only.

## Entry points

| Import | Runs in | Contents |
|---|---|---|
| `@rocklobster42195/streamdeck-kit` | Plugin (Node) | Rendering helpers, animation, Panorama effects, state and timing helpers. Safe to import in the plugin backend. |
| `@rocklobster42195/streamdeck-kit/bridge` | Plugin (Node) | `piBridge`, the plugin side of the property inspector. Imports `@elgato/streamdeck` (a peer dependency), which is why it has its own entry point. |
| `@rocklobster42195/streamdeck-kit/bus` | Plugin (Node) | `DeckBus`, the kit's implementation of **deckbus**, a local bus between plugins (see below). |
| `@rocklobster42195/streamdeck-kit/mdi` | Plugin (Node) | Search over all Material Design Icons (see below). |
| `@rocklobster42195/streamdeck-kit/pi` | Property inspector (browser) | Socket client, i18n, components. Bundle it into your PI script (e.g. with Rollup). |
| `@rocklobster42195/streamdeck-kit/styles/pi-theme.css` | Property inspector | The theme. Copy it next to your PI pages at build time. |

## Rendering and animation

```ts
import { FrameTicker, MARQUEE_TICK_MS, truncateToWidth, wrapToWidth } from "@rocklobster42195/streamdeck-kit";

const frames = new FrameTicker(MARQUEE_TICK_MS); // one ticker for all animations of the plugin
const title = truncateToWidth("A rather long track title", 13, 180);
const lines = wrapToWidth("Two lines that fit the touch strip", 13, 180, 2);
```

- `measureArialWidth`, `truncateToWidth`, `wrapToWidth`, `balanceLines`: real Arial (regular and bold) glyph widths, because Stream Deck renders SVG text in Arial reliably.
- `marqueeSvg`, `marqueeNeeded`, `marqueeOffset`: time-based scrolling text.
- `TitleFader`: a title band that fades in, scrolls and fades out.
- `AnimatedValue`, `FrameTicker`: eased values and a frame loop that stops when nothing moves.
- `frames`: the plugin's shared `FrameTicker` (80 ms). Everything below animates on it.
- `glide(key, target, redraw)`: a value that eases toward its target, e.g. a volume ring.
- `ColorFader`: a color that fades to the next one, e.g. a ring following the cover color between tracks.
- `loadCover`, `getCachedCover`: fetch images once into a small LRU cache of data URIs. `CoverFader` holds the last image while the next one loads, then crossfades.
- Touch-strip helpers (200×100 SVG segments): `stripImage`, `text`, `mdi`, `image`, `progressBar`, `scrimDisc`, `scrimBox`, `fit`, `wrap`, `textWidth`, `escapeXml`, `formatTime`.
- `encodePngDataUri`: raw RGBA into a PNG data URI, for raster images that must be built synchronously.

## Gauges

```ts
import { arc, pie } from "@rocklobster42195/streamdeck-kit";

const ring = arc(72, 72, 54, 0.42, "#6cc4ff", { width: 14 }); // SVG parts: track + arc
const torte = pie(50, 50, 38, 0.42, "#cccccc");               // SVG parts: outline + wedge
```

- `arc(cx, cy, r, value, color, { track, width })`: a ring gauge with a round-capped arc from 12 o'clock, clockwise (MA-C's volume ring).
- `pie(cx, cy, r, value, color, { inner, stroke })`: an outline circle and a filled wedge, also from 12 o'clock (Sonos Controller's volume look). Without options, the wedge radius and stroke follow Sonos Controller's proportions: 7 and 1.5 for r 9, 30 and 6 for r 38.
- `halfArc({ cx, cy, r, min, max, value, target, zones, width, track, color })`: a half-circle gauge from 9 o'clock over the top to 3 o'clock, in the value's own unit (°C, W, %). Colour zones (`Zones`, as for meters) show as dim bands on the track, the value as a filled arc in its zone's colour, and `target` as a marker, e.g. a thermostat's setpoint. `halfArcPosition` and `halfArcPoint` give positions for labels.

Both take `value` from 0 to 1 and return SVG fragments to put into a key or strip image.

### Level meters

```ts
import { meterBar, meterScaleMarks, MeterBallistics, VuBallistics, vuMeter, dbfsToVu, METER_TICKS } from "@rocklobster42195/streamdeck-kit";

const left = new MeterBallistics(); // fast attack, 20 dB/s release, 1.5 s peak hold
const s = left.update(measuredDb, Date.now());
meterBar({ x: 8, y: 32, length: 184, thickness: 22, levels: [s.level], peaks: [s.peak] }); // mono: one bar, stereo: [l, r]
meterScaleMarks(8, 71, 184, METER_TICKS);

const needle = new VuBallistics(); // 300 ms VU inertia
vuMeter({ x: 40, y: 4, width: 120, height: 82, vu: needle.update(dbfsToVu(measuredDb), Date.now()), label: "MONO" });
```

- `meterBar`: segmented LED bars, lying or standing, one per channel. It has zone colours (green, yellow from -18 dB, red from -6 dB) and a peak line.
- `scalePosition`, `METER_SCALE` and `zoneColor`: the dBFS scale (-60 to 0, with more room near the top) and the colour zones. Both can be replaced.
- `MeterBallistics` (digital) and `VuBallistics` (analog): how the shown level follows the measured one.
- `vuMeter`: an analog VU meter with a cream face, arc scale from -20 to +3 VU, a red zone and a needle. `dbfsToVu` sets 0 VU to -18 dBFS by default.

## Device frame

`deviceFrame({ screenWidth, screenHeight, knobs: 4 })` draws a Stream Deck housing as SVG: a dark body, the screen well and, for the Stream Deck +, the knobs. It is meant for screenshots, READMEs and store pictures. Put your rendered deck at `screenX`/`screenY` on top:

```ts
const frame = deviceFrame({ screenWidth: deck.width, screenHeight: deck.height, knobs: 4 });
await sharp(Buffer.from(frame.svg)).composite([{ input: deckPng, left: frame.screenX, top: frame.screenY }]).png().toFile("deck.png");
```

## State and timing

- `OptimisticStore`: short-lived local overrides of server state, so a key shows a change at once and reconciles when the device confirms it.
- `LatestSender`: sends only the latest value, at most once per interval. Use it for dial rotations.
- `AlarmTimers` and `alarmTimers`: countdowns that fire even while their key is not on screen, with catch-up and retry.
- `computeFadeSteps(from, to, durationMs, minStepIntervalMs?)`: plans a volume ramp (0..100).

## Logging

The kit reports problems, such as an image that failed to load or an effect that threw, to `console` by default. Route them to the plugin log once at startup:

```ts
import streamDeck from "@elgato/streamdeck";
import { setKitLogger } from "@rocklobster42195/streamdeck-kit";

setKitLogger(streamDeck.logger);
```

## deckbus (`/bus`)

Stream Deck plugins can't talk to each other. **deckbus** lets them, and any other local program, share state, stream data, send requests and broadcast, without a central server or master. Every peer is equal, and one that goes away never takes the others down. The protocol is open and documented in [docs/deckbus-protocol.md](https://github.com/rocklobster42195/streamdeck-kit/blob/main/docs/deckbus-protocol.md), so programs without this kit can join too.

```ts
import { DeckBus, DuckLeases, serveDucking } from "@rocklobster42195/streamdeck-kit/bus";

const bus = new DeckBus({ id: "de.example.mixer-plugin", name: "Mixer", version: "1.0.0", caps: ["meters"] });
await bus.start(); // false (and logged) if it can't: the plugin works on without the bus

bus.setState("status", { online: true }); // soft state, sent again after every reconnect
bus.onPeers((peers) => console.log(peers.map((p) => p.name)));

bus.onSubscribers("meters/main", (n) => (n ? startMeters() : stopMeters())); // produce only while someone listens
bus.publish("meters/main", { l: -18.5, r: -20.1 });

// Ducking: leases per peer and target (deepest wins, ends on unduck, after maxMs or when the peer leaves)
const leases = new DuckLeases(({ target, db, rampMs }) => fadeTo(target, db, rampMs)); // db 0 = restore
serveDucking(bus, leases, { allow: (peer) => allowedPeers.includes(peer.id), has: (target) => target === "meters/main" });
await otherBus.request("de.example.mixer-plugin", "duck", { target: "meters/main", by: -12 });

bus.broadcast("alert", { text: "Doorbell" });
```

- **Addresses:** 16 slots, named pipes on Windows and Unix sockets elsewhere. The peer in the higher slot connects to the lower one.
- **Access:** a per-user key file keeps other users out.
- **Versions:** negotiated per pair of peers.
- **Stream data:** the latest value wins when a peer is slow; nothing piles up.
- **Tools in the repository:** `tools/bus-monitor.mjs` shows who is on the bus and what they send; `tools/bus-fake-meters.mjs` is a fake meter source for testing.

## Icon catalog (`/mdi`)

`@rocklobster42195/streamdeck-kit/mdi` provides `searchMdi(query)`, `mdiPath(name)` and `mdiLabel(name)` over all [Material Design Icons](https://pictogrammers.com/library/mdi/), so users can pick any icon for a key. It imports the whole icon set, which adds about 3 MB to the plugin bundle. That is why it has its own entry point.

## Panorama effects

A Panorama effect is one animated picture that spans several dials of a Stream Deck +. Each dial renders its own slice, and all dials move in sync.

- `PanoramaEngine` runs the effects, and `PanoramaOrchestrator` groups neighbouring dials.
- `effectRegistry`, `listEffects()` and `withEffectDefaults()` cover the built-in effects: particles, matrix rain, boing ball, boing globe and blank.
- `EffectDefinition` is the interface for writing your own effect.
- **Audio-reactive:** `engine.setLevel(display, level)` with a level from 0 to 1 (e.g. mixer meters from deckbus) makes the effects move with the music. A group follows its loudest display, and `undefined` switches it off. Your own effect takes part by implementing `setLevel(level)`.

## Property inspector kit

```ts
import { definePiComponents, initConditionalVisibility, sd, translateDom } from "@rocklobster42195/streamdeck-kit/pi";

sd.onReady(() => {
    translateDom();
    definePiComponents();
    initConditionalVisibility();
});
```

```html
<pi-section title="pi.display">
    <pi-toggle setting="showProgress" label="pi.show_progress" hint="pi.show_progress_hint"></pi-toggle>
    <pi-range setting="preset" min="0" max="100" step="1" default="20" label="pi.preset" unit="%"></pi-range>
    <pi-color setting="color" default="#87AE73" label="pi.color"></pi-color>
    <pi-field setting="serverUrl" global label="pi.server_url" placeholder="pi.server_url_placeholder"></pi-field>
    <div data-show-when="command=up,down">Shown only for these commands</div>
</pi-section>
```

- `sd`: the PI socket client. It covers action settings and global settings (`setSetting`, `setGlobalSetting`), `sendToPlugin`, `onMessage` and `openUrl`.
- Components:
  - `<pi-section>`: a titled card
  - `<pi-toggle>`: a switch
  - `<pi-field>`: a text or password field
  - `<pi-range>`: a slider
  - `<pi-choice>`: tiles for choosing one option
  - `<pi-color>`: a color picker
  - `<pi-select source="…">`: a dropdown whose entries the plugin provides (see the PI bridge below). `with="player"` sends parameters that the PI registered with `registerSelectParams("player", () => ({ playerId }))`, and the list reloads when they change. `label-setting` also stores the chosen label. `refreshPiSelects()` and `reloadPiSelects()` update all lists after the plugin pushed new state.
  - `<pi-icon-picker setting="icon" default-icon="mdiBullhorn">`: search and pick any Material Design Icon. For optional icons (e.g. a marker), set `none-label` and `reset-label`.
  - `<pi-thresholds setting="thresholds" base-setting="color" unit="°C" min-setting="min" max-setting="max">` (or `unit-setting="unit"` for the unit the user typed): colour ranges for a value: a base colour and "from … : colour" rows, with a bar that previews them between min and max. Stored as `[{ from, color }]`, sorted, ready to use as `Zones` after the base colour.

  Add `global` to bind a component to global settings instead of the action's settings.
- `data-show-when="setting=a,b"` shows an element only for those values. Prefix the key with `global:` to check a global setting.
- `t(key, vars)` and `translateDom()` handle i18n. Components treat `label`, `hint` and `placeholder` as translation keys. Translations come from `window.PI_LOCALES` (`{ en: {...}, de: {...} }`), which your build generates from the `Localization` blocks of your plugin's `<lang>.json` files. Nested groups work the same way as in the plugin SDK: `pi.player` looks up `Localization.pi.player`.
- The kit brings its own texts (`kit.*`, English and German), such as "Choose" or the icon search placeholder. `t()` uses them when your locale files don't have the key, so you can override any of them in your `<lang>.json`.
- `nextRequestId()`: ids for your own requests to the plugin. All kit components share the counter, so replies never reach the wrong component.

## PI bridge (plugin side)

`piBridge` is the plugin side of the property inspector. It knows which PI is open, answers the kit components' requests, and pushes your state to the open PI. Unchanged messages are not sent again.

```ts
import { piBridge } from "@rocklobster42195/streamdeck-kit/bridge";
import { mdiOptions } from "@rocklobster42195/streamdeck-kit/mdi";

piBridge.init();
piBridge.registerOptions("mdi-icons", mdiOptions); // <pi-icon-picker>
piBridge.registerOptions("inputs", ({ playerId }) => inputsOf(playerId)); // <pi-select source="inputs" with="player">
piBridge.handle("reconnect", () => connection.reconnect()); // your own requests
piBridge.addPusher(() => [{ event: "status", status: currentStatus() }]); // your own state
connection.onChange(() => piBridge.schedulePush());
```

- `updatePreview(actionId, preview)` forwards what a key shows to its open PI (`{ event: "preview" }`).
- `reply(msg)` answers a request.
- The kit's messages are typed in `KitPiRequest` and `KitPiPush`, and list entries in `OptionItem`.
- `@elgato/streamdeck` is a peer dependency. When you link the kit from a local checkout, tell your bundler to use one copy (Rollup: `nodeResolve({ dedupe: ["@elgato/streamdeck", "@elgato/utils"] })`), or the bridge talks through a second SDK instance that never connects.

## License

MIT © Boris Kemper
