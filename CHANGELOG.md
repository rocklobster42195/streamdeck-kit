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
- Level meters: segmented `meterBar` (mono or stereo, lying or standing, peak line), `meterScaleMarks`, the dBFS scale and colour zones, `MeterBallistics` (digital) and `VuBallistics` plus `vuMeter` (analog VU, for XR-C's "Classic" style).
- From MA-C's settings panels: `<pi-select>` (lists from the plugin, with registrable request parameters) and `<pi-icon-picker>` (optional icons with `none-label`/`reset-label`), `nextRequestId()`, the kit's own texts (`kit.*`, EN/DE), and `piBridge` on the plugin side (entry point `/bridge`: option lists, own requests and pushes, previews). `mdiOptions` serves the icon picker. `@elgato/streamdeck` is a peer dependency.
