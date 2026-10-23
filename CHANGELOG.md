# Changelog

All notable changes to `@rocklobster42195/streamdeck-kit`. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [Semantic Versioning](https://semver.org/) (0.x: minor versions may break).

## [Unreleased]

### Changed

- **Colour effect: "the effect's own" colour is the family's sage green (`#87AE73`)** instead of a near-black grey-blue, which was easy to take for "nothing happens".

### Fixed

- **Panorama: the fixed row colour could not be picked.** The colour swatch under "Fixed" (and an effect's own colour field) had no size and shrank to 6 px, so it was invisible. It is the same 44 × 30 px swatch as everywhere else now.

## [0.1.0-alpha.37] — 2026-10-23

### Added

- **Panorama effects "Colour" and "Image"** (GitHub #6 of Sonos Controller). *Colour* takes the row's colour (Cover, fixed or the effect's own) and can fade to dark across the whole row. *Image* spreads a picture over the row, cut into one piece per dial: Fill / Fit / Stretch, a position for Fill, and "Darken the picture". The picture comes from a **file** (picked in the PI, scaled to at most 4000 px there, kept in a folder shared by the plugins, `configurePanoramaStorage`) or a **web address** (a webcam: http(s), optional user and password as Basic auth, a refresh from 10 s to 10 min, the last good picture stays, the status shows in the PI; user and password never go over deckbus or into a log). Animated **GIFs** play (up to 60 frames, else the first one), also from a web address. **Ken Burns:** now and then (every 30-600 s) one slow zoom or pan to a new view in a random direction, rest in between; the pieces are made once, the motion is only a transform, so a step costs nothing. New effect field type `source`, new effect options `rowColor: false` (the PI leaves the row colour out) and `EffectInstance.tickMs()` (an effect may speed up or slow down).
- **Row setting "Soft backing behind ring and text"** (`rowScrim`, default on). Off draws the dials flat, without the dark discs and boxes behind the ring and text, for every effect (the slice is marked with `data-kit-flat`; `isFlat`, `flatUnderlay`).
- Texts for all of it in en, de and es; error texts of a web picture are translated in the PI.
- Tools: `tools/pi-harness.mjs` (the real Panorama section of the PI in a browser with a faked plugin side, also as screenshots), `preview-panorama-backgrounds.mjs`, `preview-panorama-motion.mjs`, `preview-panorama-player.mjs`. New dependency `omggif` (GIF).

## [0.1.0-alpha.36] — 2026-10-22

### Fixed

- **`<pi-key-color>`: the Stream Decks without dials follow the SDK's device types.** alpha.35 left the Panorama tile out for type 9 as "Network Dock" (it is the Stream Deck Neo, also without dials) and missed the Corsair Voyager (6).
- **One symbol size on every key, no discs** (feedback from a beta tester: "consistency is key"). Play, Next/Previous, Volume +/−, shuffle/repeat, the paused play symbol on a dimmed cover and the skip symbol are all drawn at 72 px (`KEY_GLYPH`) straight on the key or the dimmed cover: no dark disc, no fade. Before they were 112, 100, 72 and 48 px, some on a disc. A key with a caption uses 60 px (`KEY_ICON.withCaption`), placed lower so icon and caption read as one group instead of the icon floating at the top. `KEY_ICON.full` is now 72 px, so every plugin that uses it follows.
- **Loading hourglass: no disc, one size.** On a plain key (Playback, Volume) the hourglass replaces the symbol instead of lying over it; on a cover it sits straight on the dimmed cover. It is drawn at 52 px (`HOURGLASS`) because its path fills 20 of 24 units, so it looks as large as the other symbols.
- **Shuffle: the thin crossed arrows are "on", the parallel arrows "off"** (`mdiShuffle` / `mdiShuffleDisabled`; the thick `mdiShuffleVariant` is gone).
- **Errors are always in the same place: top left on a key, bottom left on a dial.** A failed command and "offline" (multi-state key, and the new `keyOfflineBadge()` / `dialOfflineBadge()` / `offlineBadge()` for plugins) are now the same badge in the same spot. Before, a failure was bottom left on keys (over the caption and the progress bar) and offline was a bigger cloud top right, where the key marker sits.

## [0.1.0-alpha.35] — 2026-10-16

### Fixed

- **A slow command no longer puts the hourglass on every key of the player.** The status is per kind of command now: a slow skip, play or seek shows on the Play/Pause, Playback Control and Track keys, a slow volume or mute only on the volume keys and dial (a failure the same). `PlayerBoard.status(player, now?, scope?)` takes the `scope` (`'media'` or `'volume'`); without it any command counts, as before. A player the plugin calls `busy` still shows on all.
- **Grey is grey: the Play/Pause key** no longer tints the paused play symbol and the progress bar with the cover's colour when its colour is Grey (Cover still does), and an active toggle on a Playback Control key stays in the plugin's accent or the key's light grey instead of the cover's colour.
- **Volume key: Cover, Like Panorama and Fixed colour the louder and quieter symbols** (they were white whatever the setting said; only the preset and the gauge took the colour). Grey stays grey.
- **Settings window: the tab bar no longer jumps from the first section to the last.** The line a section has to pass slides down the window as the page scrolls to its end, so a short page marks every section in turn; a tab you click stays marked until you scroll by hand.

### Added

- **`PlayerBoard` takes `{ loadingAfterMs }`** (default 600): how long a command may take before the keys show it as loading, for a plugin whose devices answer slowly anyway (Sonos with TIDAL needs about 1.4 s to skip).

### Changed

- **`<pi-key-color>` leaves out "Like Panorama" on a Stream Deck without dials** (Stream Deck, Mini, XL, Mobile, Pedal, G-Keys, SCUF, Network Dock): there is no Panorama row to take the colour from. A key already set to it keeps the tile; an unknown device type shows it.

## [0.1.0-alpha.34] — 2026-10-15

### Added

- **Level strip: the icon of the open ring sits in the gap at the bottom** (the family's place for it, as `openRing`'s own `icon`), no longer in the middle. The ring and the pie keep it in the middle.
- **`openRing` takes an `icon`** (an MDI path, with `iconSize` and `iconColor`): drawn in the gap at the bottom of the ring, centred under its middle, grey while dimmed. One place for the icon instead of each plugin choosing its own (asked for by Home Assistant Controller, where a name on the strip pushed the icon out). Nothing changes for callers that don't pass it.

## [0.1.0-alpha.33] — 2026-10-15

### Changed

- **Settings panel texts name plugins in full** (Home Assistant Controller, System Audio Controller) instead of their short names, in English, German and Spanish: the call hint, the Panorama colour hints.

## [0.1.0-alpha.32] — 2026-10-15

### Changed

- **Dial lists glide at 25 frames a second** (their own 40 ms clock instead of the shared 80 ms one), so a list turning one entry per click reads as smooth rather than stepping, as the cover crossfade did before. The marquee in the list keeps its pace.
- **Boing Ball and Boing Globe: the colour glides** to a new cover colour (like Particles and Matrix Rain) instead of cutting in at every track change, and a colour that would vanish against its partner is pushed away from it: a pale cover darkens against the white checker, a blue cover is lightened against the ocean. The default green and blue are unchanged.

## [0.1.0-alpha.31] — 2026-10-15

### Fixed

- **`<pi-multi-tap>`: spacing** of the tap speed label and its tiles (they sat too close to the hint and the card's edge).

## [0.1.0-alpha.30] — 2026-10-15

### Added

- **Play/Pause key: double tap = next, triple tap = previous** (opt-in, `multiTap` in the key's settings; `tapSpeed` "fast" 250 ms, "normal" 350 ms, "slow" 500 ms). A single tap then waits a moment before it plays or pauses; without `multiTap` the key acts on press as before. The key shows the skip symbol for a moment. `PlayPauseKeys.skip(id, 'next' | 'previous')`, `tapWindow(settings)`, `TapCounter` (the reusable tap counter, SDK-free), PI component `<pi-multi-tap>` and the texts `kit.multi_tap*` / `kit.tap_speed*` (EN, DE, ES).

## [0.1.0-alpha.29] — 2026-10-11

### Changed

- **The cover crossfade runs at 25 frames a second** (its own 40 ms clock instead of the shared 80 ms one), so it is smooth rather than stepping; the covers are small now, so the frames cost little.
- **Progress bars of the Track dial and the volume display grow in whole pixels**, so a bar that hasn't moved a pixel is the same picture as before and isn't sent again.

## [0.1.0-alpha.28] — 2026-10-11

### Fixed

- **A track's data no longer blanks the other route's cover.** The fresher route's track (alpha.27) takes only the fields it actually has, so a Sonos cover that is still loading doesn't empty the one Music Assistant has.
- **Play/Pause key: cover, then band, then text.** While the cover crossfades the title waits, so one thing moves at a time; the crossfade itself is linear (a smoothstep over ten frames barely moved at first and then jumped).

### Changed

- **Much less to send to Stream Deck** (measured 2026-10-11: about 6.3 MB/s for three plugins, now about 1.8 MB/s). The particle effect leaves out every line and particle that lies wholly beyond a display's slice (a slice carried all 600 lines of the row, most far off to the side). The cover cache takes a `resize` hook (`configureCoverCache({ resize })`), and `coverResizer(maxSide = 256, quality = 82)` is a pure-JavaScript one (`jpeg-js`, `pngjs`; a native module doesn't ship with a packed plugin): a 640 px, 200 KB cover became about 15 KB. Without the hook covers stay as served.

## [0.1.0-alpha.27] — 2026-10-11

### Fixed

- **A new track showed late on the plugin that waits for Music Assistant.** The plugin that learns of the next track first (the speaker's own plugin) now gives it to the deck at once: `PlayerBoard.publish` stamps `PlayerEntry.titleAt` when a player's title or artist changes, and of the routes of one device the one with the fresher title (with its cover, colour and position) wins, until the other one catches up with a later change. A route that stands still while another plays never wins.

## [0.1.0-alpha.26] — 2026-10-11

### Added

- **Panorama text across plugins:** `TextRuns` (title and artist, or a lyrics line, over a run of Panorama dials of several plugins: dials mark themselves `canvas` in the shared "actions" state, the one whose text changed last decides, every display draws its window of it). `trackOverlay`, `lyricsOverlay` and the other Panorama text overlays moved here from MA-C.

## [0.1.0-alpha.25] — 2026-10-10

### Fixed

- **Closing a YouTube tab left the keys empty.** An app that has quit stays as a (closed) player so "Play" can start it again, and being the one that started last it stayed the active player. `active` and `active:all` skip a closed app while anything else is there, so the keys go back to what played before (the playlist on the speaker). `PlayerEntry.closed`.

### Added

- **`<pi-diagnostics>` and `registerDiagnostics()`**: the settings window ends with a collapsed "Diagnostics" field (added by the window itself; a page can place its own). The plugin gives the end of its log file (`tailLines`), a report header (`reportHeader`: plugin, kit, Stream Deck, system, the other plugins on deckbus, plugin-specific lines through `extra`) and shows the file in the file manager (`revealFile`); everything passes `redactLog()` (tokens, passwords, credentials in URLs, e-mail addresses, long opaque strings; private IP addresses stay). `KIT_VERSION`. The copy runs in the plugin (`copyToClipboard`, `reportText`: Stream Deck's browser doesn't answer the page's own clipboard calls); the footer gets a "Log" link beside "Help & feedback" that opens the settings window at the field.

- **`nowPlayingCard` hint icons:** `hintIcons` (MDI paths) draws a row of small icons (rotate, tap, push) in place of the hint's words.

### Changed

- **Panorama colour "Active player" and "Active player, also apps"**, as on the keys: the row's cover colour "Active player" follows the active **speaker** (apps on the PC no longer take it over when a video starts); the new choice "Active player, also apps" (`cover-all`) includes them. A PC without any speaker still follows its apps with "Active player". `CoverEntry.kind`, `COVER_ALL_CHOICE`.

## [0.1.0-alpha.24] — 2026-10-10

### Added

- **Status in the corner** (grill 2026-10-10): the universal keys (Play/Pause, Playback Control, Volume) and the Volume and Track dials show a small badge at the bottom left when a command takes a while ("loading", an hourglass, after 0.6 s) or was refused (a red mark for four seconds). `PlayerEntry.busy`: a plugin marks a player whose command takes a while, so every plugin's key for it shows "loading" (older peers ignore the field). `PlayerBoard.status(player)` and `statusBadge()` / `keyStatusBadge()` for the plugins' own displays.

- **Transport commands are logged** through the plugin's logger (`setKitLogger`): `[transport] next → MA-C "Küche" ok in 63 ms`, or a warning with the error and the time it took. Which plugin got a command, and what became of it, is in the log now.

## [0.1.0-alpha.23] — 2026-10-10

### Fixed

- **A new cover's colour reached the Panorama late.** Particles counted its colour fade in steps of 50 ms, but the host ticks every 100 ms, so the 2 s fade took 4 s; it runs in real time now and takes 0.8 s. Matrix Rain only coloured new glyphs while the old trails (up to five seconds) kept the previous colour; a new colour now recolours what is already drawn at once.

## [0.1.0-alpha.22] — 2026-10-10

### Added

- **Universal Track dial** (grill 2026-10-10, without lyrics: those belong in the Panorama): `TrackDials` (SDK-free), `renderTrackDial()` and `TrackDialAction` (`/keys`). Cover, title, artist and progress of any player on the deck, the cover on either side; the look "info" (text low, progress at the bottom, "LIVE" for a stream) or "eq" (bars rising above the text while it plays, also over a Panorama effect). Rotate seeks in seconds per tick (a turned position shows at once), push skips, a tap plays or pauses (explicit `play`/`pause`); title and artist scroll in counted steps. Over an effect the text gets small dark boxes. Settings `player`, `look`, `coverSide`, `seekStep`, `showTitle`, `keyColor`; options `defaultLook`, `badge` (a corner badge: source icon, battery), `feedback` (extra items for a built-in layout, e.g. clearing the title of "$A0").

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
