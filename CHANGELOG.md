# Changelog

All notable changes to `@rocklobster42195/streamdeck-kit`. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/) (0.x: minor versions may break).

## [Unreleased]

### Added

- First version, carved out of MA-C's `streamdeck-core` with its history:
  - rendering helpers: Arial text metrics, truncation and wrapping, marquee, title fader, PNG encoder
  - animation: `AnimatedValue`, `FrameTicker`
  - Panorama engine, orchestrator and effects (particles, matrix rain, boing ball, boing globe, blank)
  - the property inspector kit (`/pi`): socket client, i18n, components (`pi-section`, `pi-toggle`, `pi-field`, `pi-range`, `pi-choice`, `pi-color`), conditional visibility and the theme
- From MA-C's plugin:
  - the shared `frames` ticker, `glide`, `ColorFader`, the cover cache (`loadCover`, `getCachedCover`) and `CoverFader`
  - the touch-strip helpers (`stripImage`, `text`, `mdi`, `progressBar`, scrims, …)
  - `OptimisticStore`, `LatestSender`, `AlarmTimers`, `computeFadeSteps` (with an optional minimum step interval)
  - the Material Design Icon search as its own entry point `/mdi`
- `setKitLogger()`: one logger for everything the kit reports.
- Gauges: `arc` (MA-C's volume ring) and `pie` (Sonos Controller's volume "Torte", same geometry by default).
- **Audio-reactive Panorama:** effects can follow an audio level (`EffectInstance.setLevel`, `PanoramaEngine.setLevel(display, 0..1 | undefined)`; a group follows its loudest display). Particles speed up, the Boing Ball jumps higher when it is loud, pulses gently and squashes on the beat, Matrix Rain falls faster and the Boing Globe spins faster. Without a level (`undefined`) everything behaves as before.
- **deckbus** (`/bus`): `DeckBus`, a local bus between plugins without a master (slots, per-user key, version negotiation, soft state, streams to subscribers only, requests with per-peer permission, broadcast). The protocol is open (`docs/deckbus-protocol.md`). Also the shared `actions` state (`ActionsState`, `neighbours()`; `trackActions()` in `/bridge` feeds it from the SDK) for neighbour detection across plugins, and tools to watch it (`tools/bus-monitor.mjs`) and a fake meter source (`tools/bus-fake-meters.mjs`).
- deckbus **ducking**, receiving side: `DuckLeases` (per peer and target, deepest wins, ends on `unduck`, after `maxMs` or when the peer leaves; `release()` when the user takes over), `parseDuck()` and `serveDucking()`. The protocol describes the rules (`docs/deckbus-protocol.md`, "duck"). `streams` entries may carry `"input": true` (a mic: music-following plugins skip it). `DeckBus.request()` also takes a `PeerInfo`, for two peers with the same id (a plugin in the simulator next to the same plugin in Stream Deck).
- Gauge `halfArc`: a half circle with colour zones as bands, the value as a filled arc in its zone's colour, and a target marker (a thermostat's setpoint); values in their own unit between min and max.
- `<pi-thresholds>`: colour ranges for a value (base colour plus "from … : colour" rows) with a preview bar; kit texts `kit.threshold_*`.
- `deviceFrame`: a drawn Stream Deck housing (with knobs for the Stream Deck +) for screenshots and READMEs.
- Level meters: segmented `meterBar` (mono or stereo, lying or standing, peak line), `meterScaleMarks`, the dBFS scale and colour zones, `MeterBallistics` (digital) and `VuBallistics` plus `vuMeter` (analog VU, for XR-C's "Classic" style).
- From MA-C's settings panels: `<pi-select>` (lists from the plugin, with registrable request parameters) and `<pi-icon-picker>` (optional icons with `none-label`/`reset-label`), `nextRequestId()`, the kit's own texts (`kit.*`, EN/DE), and `piBridge` on the plugin side (entry point `/bridge`: option lists, own requests and pushes, previews). `mdiOptions` serves the icon picker. `@elgato/streamdeck` is a peer dependency.
