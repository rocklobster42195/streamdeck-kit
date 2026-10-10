# Changelog

All notable changes to `@rocklobster42195/streamdeck-kit`. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/) (0.x: minor versions may break).

## [Unreleased]

## [0.1.0-alpha.21] — 2026-10-10

### Added

- **Universal Volume dial** (grill 2026-10-09, Sonos Controller's look): `VolumeDials` (SDK-free), `renderVolumeDial()` and `VolumeDialAction` (`/keys`). Rotate sets the volume of any player (a turned value shows at once until the player confirms; only the latest is sent, ~150 ms; a fast spin doubles the step), push mutes, a tap recalls the preset and unmutes, a long tap saves the current volume as the preset. Pie, ring or open ring with an optional icon, text left, right or centred; muted: grey gauge with a red speaker. Settings `player`, `step`, `preset`, `gauge`, `align`, `showText`, `icon`, `keyColor`, `title`.

## [0.1.0-alpha.20] — 2026-10-09

### Added

- `<pi-multi-select>`: from 9 rows on, a search field above the list (label, second line and value; chosen rows stay in sight).

## [0.1.0-alpha.19] — 2026-10-09

### Added

- Volume key: with a `preset` on another command (mute, louder, quieter), a long press sets the preset volume, unmuted (sonos-controller's keys did that); without one the key acts at once.

## [0.1.0-alpha.18] — 2026-10-09

### Added

- **Universal Volume key** (grill 2026-10-09, family style): `VolumeKeys` (SDK-free), `renderVolumeKey()`, `volumeIcon()` and `VolumeKeyAction` (`/keys`). Louder and quieter from the volume the key shows (absolute `volume`, or `volume-by` for a player that only takes steps), mute as a ring, pie or open ring (grey with a red speaker while muted), a preset volume that is "on" while the volume is at it (and unmutes). Pressed values show at once until the player confirms them. Settings `player`, `command` (`up`, `down`, `mute`, `preset`), `step`, `preset`, `showVolume`, `gauge`, `keyColor`, `marker`.

## [0.1.0-alpha.17] — 2026-10-09

### Fixed

- Settings panel: a hint straight in a card (e.g. the seek step's under its tiles) started at the card's edge; it has the card's inner spacing now.

## [0.1.0-alpha.16] — 2026-10-09

### Added

- **Universal Playback Control key** (grill 2026-10-09, the "family" style chosen by the user): `PlaybackKeys` (SDK-free) and `PlaybackControlKeyAction` (`/keys`). One key per command: next, previous, shuffle, repeat (off → all → one), and where the player has them crossfade and "Don't stop the music"; toggles flip at once with the "on" plate and frame until the player confirms; Next/Previous held half a second switch seek mode (taps add up to one seek, the key shows the jump). Settings `player`, `command`, `seekStep`, `keyColor`, `marker`; option `accent` for a grey key's "on" colour.
- Players: commands and fields `crossfade` and `autoplay` (Music Assistant's crossfade and "Don't stop the music"), both about what plays.

## [0.1.0-alpha.15] — 2026-10-09

### Changed

- Play/Pause key: the paused look (dimmed cover, play symbol) fades in when it pauses and out when it plays again (500 ms); a key's first picture doesn't fade. `renderPlayPauseKey()` takes `dim` (0..1).

## [0.1.0-alpha.14] — 2026-10-09

### Changed

- Players: what a merged player shows comes from the device's own media first, when it plays or, with nothing playing, when it had some (a radio started in the Sonos app, playing or stopped), not from another plugin that still believes its queue plays (Music Assistant learns of it late).

## [0.1.0-alpha.13] — 2026-10-09

### Added

- Player entries: `members` (the devices playing in a group); `resolve("device:<member>")` finds the group a speaker plays in, so a key bound to one room keeps controlling it while it is grouped.

## [0.1.0-alpha.12] — 2026-10-09

### Added

- **`PlayPauseKeyAction`** (new entry point `/keys`, the kit's part that uses the Stream Deck SDK): the universal Play/Pause key as a whole action. A plugin subclasses it with its UUID and passes its players; optional `migrate` (older settings), `unavailable` (a picture while no player is found, e.g. "set up"), `onDraw` (e.g. a settings-panel header) and `refresh()`.

## [0.1.0-alpha.11] — 2026-10-09

### Changed

- `<pi-corners>` starts with picking the icon ("my icon", formerly "marker"), always shown; its tile then shows that icon, so it's clear what it is. New kit text `kit.corners_title` for the card ("Icons at the top" / "Symbole oben" / "Iconos arriba"). `<pi-icon-picker>` fires `pi-icon` with the chosen icon's path.

## [0.1.0-alpha.10] — 2026-10-09

### Changed

- `<pi-corners>` picks the marker's icon too, inside its card, while a corner shows the marker (the marker no longer needs its own section). Built once and then only updated, so a marker search in progress survives a settings change.
- The corners' marker and service logos share one colour (`CORNER_COLOR`); a one-colour SVG logo is painted in it (`svgGroup(…, color)`).

### Fixed

- Settings panel: the labels and hint of `<pi-key-color>` and `<pi-corners>` started right at the card's edge; they have the card's inner spacing now.

## [0.1.0-alpha.9] — 2026-10-09

### Added

- Play/Pause key corners: a `sourceIcon` that is an SVG data URI (a music service's logo) is drawn inline (`svgGroup()`), since Stream Deck draws no nested SVG and doesn't load one through an image.
- **Service logos by name** (`serviceIcon()`): small monochrome logos of 14 music services (Spotify, Apple Music, TIDAL, Deezer, YouTube Music, SoundCloud, Plex, Audible, Sonos, Jellyfin, Napster, Pandora, iHeartRadio, Bandcamp; from Simple Icons, CC0) for the source corner when a plugin knows the service only by its name (Sonos); radio services get a radio, one's own files a folder, others a note. Spellings like "apple_music", "TIDAL", "ytmusic" or "Sonos Radio" are found too.

## [0.1.0-alpha.8] — 2026-10-09

### Added

- **Universal Play/Pause key** (grill 2026-10-09): `PlayPauseKeys` (all of a plugin's Play/Pause keys on the `PlayerBoard`: which player, the picture, explicit play or pause by what the key shows, the pressed state shown until the device confirms it, the position frozen while paused), `renderPlayPauseKey()` (sonos-controller's key: cover, dimmed with ▶ while paused, scrolling title, progress pill) and two corners the user fills: nothing, marker, source or battery (`batteryBadge()`, `cornerSvg()`). `<pi-corners>` picks them in the settings panel (EN/DE/ES).

## [0.1.0-alpha.7] — 2026-10-09

### Fixed

- **Shared Panorama: a dial of a plugin that restarted stayed black** until the plugin leading the row restarted too. When the new process joined before the old one was gone, the leader dropped and re-added that dial within one debounced regrouping; its group stayed the same, so the dial's link to it was never set again and its slice was never drawn.

## [0.1.0-alpha.6] — 2026-10-09

### Changed

- **Players: device and media split** (grill 2026-10-09). When one device has two owners (a Sonos speaker playing Music Assistant's stream: SO-C for the device, MA-C for the media), whether it plays comes from the device's plugin (MA reported "playing" all through a pause), the colour from the media's plugin (the cover it belongs to), shuffle and repeat too, and **play, pause and play-pause go to the media's plugin** like next and seek (Sonos commands break MA's stream). `can` follows the split. Only volume and mute stay with the device.

### Added

- Player entries: `source` and `sourceIcon` (where what plays comes from, e.g. "Spotify"), `battery` and `charging`.

## [0.1.0-alpha.5] — 2026-10-09

### Added

- **Multi-state key** (from HA-C, SA-C grill 2026-10-05): `stateOptions()`, `nextIndex()` and `renderMultiStateKey()` (the state's icon in its colour, its name, one dot per state); `<pi-states>` edits the list (value typed or, with `value-source`, picked from the plugin's list; name, colour, icon; move up, remove), `registerStatesCurrent()` lets a plugin offer the value its device reports now.
- **`<pi-multi-select>`**: several choices from the plugin's list, one switch each; chosen values that are away keep their names.

## [0.1.0-alpha.4] — 2026-10-05

### Added

- **"When a call starts on this computer"** `CallReaction`: a music plugin pauses or lowers (to a quarter) its chosen players while a peer reports a call, and puts back only what it did, unless the user changed it meanwhile; choices per player in the global setting `callReaction`, `<pi-call-reaction>` is the settings window's section (EN/DE/ES). `PlayerBoard.ownPlayers()` and `command()` for a plugin's own players.
- deckbus protocol: state **`call`** (whether the computer is in a call, with the app) and **`mic.users`** (the apps recording from the mic), first from SA-C.

## [0.1.0-alpha.3] — 2026-10-05

### Added

- **`CoverServer`**: serves images a plugin only has as bytes (Windows' media sessions; later images behind a login) on `127.0.0.1` and a free port, so `loadCover()` and other plugins' keys load them like any cover URL. Keyed by content by default, the newest 16 stay, never keeps the process alive. First used by SA-C's Windows players.

## [0.1.0-alpha.2] — 2026-10-04

### Added

- **Players on deckbus** (grill 2026-10-04): state `players` (a superset of `covers`: device, kind speaker/app, title, cover, position, volume, shuffle/repeat, what the player can do) and request `transport` (play/pause, next, previous, seek, volume, mute, shuffle, repeat), accepted by default and switchable per plugin; up to 10 s for an answer (a device may have to wake up). `PlayerBoard` publishes a plugin's players, merges everyone's by device (commands and the colour from the plugin that talks to the device directly, except seek, next, previous, shuffle and repeat, which go to the plugin whose media plays; title and cover from that one too), finds a key's player by its choice (`active`, `active:all`, `device:…`, `app:…`, `<plugin>/<player>`) and sends commands, to its own players directly and to others over the bus. `positionNow()` counts a playing position on. `CoverBoard` reads colours from `players` too.
- **Seek mode** `SeekStepper`: for a Next/Previous key: quick taps add up and go out as one seek after a short quiet time, shown at once (`offset`, `target`); ends by itself; stops one second before the end. `SEEK_STEPS` 5/10/15/30 s.
- **Key colour** `resolveKeyColor(choice, { cover, row })`: `grey` (default), `cover`, `row` or a fixed `#RRGGBB` for a key's icon; `<pi-key-color>` is its PI field (four tiles, the colour picker for Fixed; EN/DE/ES).
- **One colour per speaker:** a device known to two plugins shows the colour of the plugin that talks to it directly, in `PlayerBoard` and in `CoverBoard` (covers carry `device` and `direct` now).

- **Row colour for keys:** `PanoramaRows.rowColor(device)` resolves a Stream Deck's row colour (also where the plugin has no dial, from the other plugins' rows), `onRowColor()` tells when it may have changed.
- **Player dropdown** `playerOptions(players)`: "Active player", "Active player, also apps", then every player of the deck (▶ while playing, the plugins that know it), for a `<pi-select>`. `<pi-select>` shows labels starting with `kit.` translated.

### Fixed

- `readableCoverColor()` keeps near-greys grey: it raised the faint hue of e.g. a pale beige into salmon.

## [0.1.0-alpha.1] — 2026-10-04

First public version, released as an **alpha** (`0.1.0-alpha.1`, npm dist-tag `alpha`): the API still changes often and without notice.

### Added

- **The row's colour** (grill 2026-10-03): the Panorama section has one colour field for every effect — **Cover** (the active player, or one chosen player), **fixed** or **the effect's own**; the effects' own colour fields don't show any more. It is a row setting (`rowColor`), so it works in a row without a music dial (e.g. only SA-C and XR-C). The colours come from the new deckbus state **`covers`** (`CoverBoard`: music plugins publish their players' colours, everyone resolves a choice; active player = the one that started playing last). A dial's live colour (e.g. HA-C's from a lamp) still wins; the section says where it comes from (`liveColor` in `actions`).
- **List dial**: `ScrollList`, `listStrip()` and `ListController` — a smooth vertical list on a dial's touch strip (one row per tick, gliding; marked centre row; active row in the accent colour; cover, icon or no picture; marquee, overlay, placeholders, rubber band at the ends). First used by MA-C's Browser and Queue dials.
- **Level strip** (`render/level-strip.ts`, from XR-C and SA-C): a level dial's touch strip in five looks (digital, classic, ring, pie, open ring) with name, value text, position, mute, inactive, icon, name line (plain, colour, band), a second name line, a caption, a custom position bar, and the Panorama effect behind it with a dark backing only behind each element. `renderLevelMessage()` for the not-ready states, `inkOn()` for black or white text on a colour. XR-C and SA-C draw with it, byte for byte as before.
- **One Panorama per row** (`panorama/rows.ts`, grill 2026-10-02): all dials of a device form a row with one effect and one set of settings, whichever plugin they belong to. `PanoramaRows` keeps the row in agreement over deckbus (state `panorama-rows`, the latest choice wins), checks other plugins' dials (request `panorama-member`) and runs the row on the `SharedPanorama`; an unchecked dial stays a silent member (the effect runs on behind it). `<pi-panorama>` is the same Panorama section in every plugin (effect, a map of the row's dials — plugin, name and checkbox, the own dial framed —, the effect's settings; `summary` for one line in the short PI). `rowStateFromSettings()` takes old `background` settings over. Replaces "like the neighbour" (`resolveBackgrounds`, `backgroundOptions` removed). Effect names and fields in German and English come from the kit now.
- **Settings window** (`pi/window.ts`, from HA-C): a short property inspector and everything else in a bigger window that borrows the PI's connection (`sd.mirror()`). `initSettingsWindow({ name })`, `settingsWindowShown()`, `openSettingsWindow(section?)`, `showSettingsInline()`; classes `pi-win` (window only) and `pi-pi-only`; `<pi-more ready-when="…">` is the PI's button into the window ("Set up …" in blue until one of the settings is filled in); the window gets a menu with scroll spy over every `<pi-section>` and `[data-window-section]`. `.pi-pair` puts two short fields side by side.
- **Panorama inputs from outside** (`panorama/inputs.ts`): `parseColor()` reads a colour from hex, "r,g,b", `rgb(…)`, `hs(…)`, arrays, `{h, s}`, colour words (EN/DE) and the standard colours' names; `effectRange()` and `scaleToEffect()` map a number onto an effect setting's range (e.g. `savedSpeed`). `PanoramaEngine.updateLive()` / `SharedPanorama.updateLive()`: live settings that win over every member's picked settings in a group. A following dial of a shared Panorama sends its settings, live settings and level on `panorama-in/<device>/<column>`, so they count in the leader's group too.
- **Dial backgrounds** (`panorama/backgrounds.ts`): the "background" setting the same in every plugin — `resolveBackgrounds(dials, peers)` (unset/"auto" takes the neighbouring dial's effect, also another plugin's, and spreads along a row; "none"; an effect id) and `backgroundOptions({ auto, none })` for the PI.
- **Shared Panorama across plugins:** `SharedPanorama` wraps a `PanoramaEngine` with the same API and shares it over deckbus (`connect(bus)`): groups of adjacent dials with the same effect are worked out from all peers' `actions`; the plugin with the leftmost dial leads, runs the effect over the whole group and publishes the others' slices on `panorama/<device>/<column>`; the others draw what they get, and run their dials themselves again when the leader goes. Without the bus everything stays local. Documented in `docs/deckbus-protocol.md`; tests with an in-memory bus and over real pipes.
- **Family key style** (`render/key-style.ts`, from MA-C): `KEY_BG`, `KEY_TIERS` (available, off, unavailable), `KEY_ICON` (112 px, 92 px with a caption), `keyActivePlate()` + `keyActiveFrame()` ("on": tinted plate and rounded frame), `keyCaption()` (bold, fitted 28→16 px, cut with an ellipsis), `keyIcon()`, `keySvg()`. Building blocks so every plugin's keys look alike; MA-C's own renderer can move onto them later.
- **Open ring gauge** `openRing({ cx, cy, r, min, max, value, dot, zones, handle, dim })`: a ring open at the bottom (270°), as Home Assistant draws its thermostat and light cards; fills up to the value in its zone colour, a handle on the value, a dot for a second value (e.g. the room temperature). `openRingPoint()` for placing things on it. `zoneOpacity` shows the colour ranges as faint bands on the track (as `halfArc` does).
- **Key feedback:** `playFeedback(id, action, "ok" | "alert", { color, background, restore })` instead of Stream Deck's generic `showOk()` / `showAlert()`: a disc in the key's colour grows from the centre, a white check mark draws itself (or an exclamation mark on Monza red), a ring pulses out, then the key's own image comes back (~0.7 s). `feedbackFrame()` draws one frame, `isFeedbackPlaying()` tells a key not to draw over it. `width`/`height` fit it into any image, e.g. a dial's 200 × 100 touch strip (drawn centred).
- **Colour picker:** `<pi-color>` and `<pi-thresholds>` open a popover instead of the system colour field: 17 standard colours (around the colour wheel, then the greys), recent colours, colour wheel with brightness, hex and R/G/B; `<pi-color auto>` offers "automatic". `<pi-swatch>` is the swatch on its own (a drop-in for `<input type="color">`), `openColorPopover()` opens the popover from code; colour helpers in `color-math.ts`.
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
