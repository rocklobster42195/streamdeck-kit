# deckbus protocol v1

deckbus is a local message bus between Stream Deck plugins, or any other program running as the same user on the same computer. Stream Deck has no way for plugins to talk to each other. deckbus fills that gap without a central server or a "master" plugin: every participant is an equal **peer**, and a peer that goes away never takes the others down.

`@rocklobster42195/streamdeck-kit/bus` implements it in TypeScript (`DeckBus`). You don't need the kit to take part: the protocol below is small enough to implement in any language.

## Addresses

Peers meet in **16 slots** (0–15). Each peer listens in one slot:

| Platform | Address of slot `n` |
|---|---|
| Windows | named pipe `\\.\pipe\deckbus-<user>-<n>` |
| macOS, Linux | Unix socket `<temp dir>/deckbus-<n>.sock`, where `<temp dir>` is the per-user temporary directory (`os.tmpdir()` in Node, `$TMPDIR` on macOS) |

On Windows, `<user>` keeps the peers of different logged-in users apart, because named pipes share one global namespace. It is the first 8 hex digits of the SHA-1 of the user name (UTF-8).

**Joining:**
1. Try slots 0, 1, 2… and listen in the first free one. On macOS/Linux, a socket file that refuses connections is left over from a crashed peer: delete it and take the slot.
2. Connect to every **lower** slot that has a listener. The peer in the higher slot always dials, so every pair of peers has exactly one connection.
3. Every few seconds (the kit uses 5), try the lower slots again to find peers that started later.

## Key

A per-user key keeps other users' programs out. It is a text file of 64 hex characters (32 random bytes), readable only by the user:

| Platform | Key file |
|---|---|
| Windows | `%APPDATA%\deckbus\key` |
| macOS | `~/Library/Application Support/deckbus/key` |
| Linux | `$XDG_CONFIG_HOME/deckbus/key` (default `~/.config/deckbus/key`) |

The first peer creates it (create-exclusive, so peers starting at the same time agree on one key). The others read it.

## Messages

Each message is one JSON object on one line (UTF-8, terminated by `\n`). Lines that aren't valid JSON are ignored. Every message has a type `t`.

### hello

Both sides send `hello` as their first message:

```json
{"t":"hello","proto":[1],"id":"de.boriskemper.xair-controller","name":"XR-C","version":"0.1.0","caps":["meters","duck"],"slot":2,"key":"…"}
```

- `proto`: the protocol versions the peer speaks. Both use the highest common one. If there is none, send `bye` and close.
- `id`: the plugin UUID, or for other programs a reverse-domain name.
- `name`: a short name for people.
- `caps`: what the peer offers. See [shared names](#shared-names).
- `key`: the bus key. A wrong key means `bye` and close.

A peer that sends no valid `hello` within 3 seconds is disconnected. After the handshake, both sides send all their current `state` keys and `sub`scriptions (see below).

### state

The sender's own state; everyone keeps a copy per peer.

```json
{"t":"state","key":"status","value":{"online":true}}
```

`value: null` removes the key. State is **soft**: a peer owns only its own keys, and sends them all again after every (re)connect. When a peer disconnects, the others drop its state.

### sub, unsub, pub

Streams of data, sent only to peers that want them:

```json
{"t":"sub","topic":"meters/ch09"}
{"t":"pub","topic":"meters/ch09","data":{"l":-18.5,"r":-20.1}}
{"t":"unsub","topic":"meters/ch09"}
```

- A peer sends `pub` for a topic only to peers that subscribed to it. A source can stop producing while nobody listens; the kit reports the number of subscribers with `onSubscribers`.
- When a connection is backed up, only the latest `pub` per topic is kept; older values are dropped, never queued.

### req, res

A request to one peer, and its answer:

```json
{"t":"req","id":7,"method":"duck","params":{"target":"meters/ch09","by":-12,"rampMs":300,"maxMs":30000}}
{"t":"res","id":7,"ok":true,"result":{}}
{"t":"res","id":7,"ok":false,"error":"not allowed"}
```

`id` is chosen by the sender and unique per connection. The **receiver decides** whether to accept a request from that peer. Anything that changes something (like ducking) should be allowed only for peers the user has explicitly allowed. A sender treats a missing answer as an error after a timeout (the kit uses 3 seconds).

### bc

A broadcast to every peer, without an answer:

```json
{"t":"bc","event":"alert","data":{"text":"Doorbell"}}
```

### bye

Sent before closing a connection on purpose, with a reason: `{"t":"bye","reason":"wrong key"}`.

## Shared names

Names that everyone can use the same way. Anything specific to one plugin is prefixed with its id, e.g. `de.boriskemper.xair-controller/scene`.

| Kind | Name | Meaning |
|---|---|---|
| state | `status` | `{ "online": boolean, "detail"?: string }`: whether the peer's own device or service is reachable. |
| state | `streams` | Streams the peer offers: `[{ "topic": "meters/ch09", "label": "Sonos", "stereo": true }]`. `"input": true` marks a microphone or other input; plugins that move with music leave those out. |
| state | `actions` | The peer's visible actions: `[{ "device", "column", "row", "controller": "Keypad" \| "Encoder", "action", "effect"?, "label"?, "panoramaMember"?, "liveColor"? }]` (see below). |
| state | `panorama-rows` | The newest Panorama row the peer knows per device: `{ "<device>": { "effect", "settings": {…}, "stamp" } }` (see panorama). |
| state | `covers` | The colour of what each player plays, from music plugins: `[{ "player", "name", "color": "#RRGGBB", "playing": boolean, "since": ms }]` (see covers). |
| state | `players` | What each peer can play and control: `[{ "player", "device"?, "name", "kind", … }]` (see players). Replaces `covers`. |
| state | `mic` | `{ "muted": boolean, "users"?: [{ "app", "name" }] }`: the state of the computer's default microphone, from a peer that controls it (SA-C); `users` are the apps recording from it now. |
| state | `call` | `{ "active": true, "app", "name", "since": ms }` or `{ "active": false }`: whether the computer is in a call (Teams, Discord, Zoom …), from a peer that can tell (SA-C: Windows' ducking notification for communications streams, else a known call app on the mic). Ends a moment (~2 s) after the last sign of the call. Others may pause or duck music, or show it. |
| topic | `panorama/<device>/<column>` | One dial's slice of a shared Panorama: an SVG fragment (string, 200 × 100, no outer `<svg>`), one per effect tick, from the peer that leads the group (see below). |
| topic | `panorama-in/<device>/<column>` | What a following dial puts into a shared Panorama: `{ "settings": {…}, "live": {…}, "level"?: 0..1 }`, to the peer that leads the group (see below). |
| topic | `meters/<name>` | Audio levels in dBFS with one decimal, about 20 per second: `{ "l": -18.5, "r": -20.1 }`; mono sends only `l`. |
| request | `transport` | `{ "player", "command", "value"? }`: play/pause, next, seek, volume … on one of the peer's players (see players). |
| request | `panorama-member` | `{ "device", "column", "member": boolean }`: check or uncheck the peer's dial at that place in its row's Panorama. |
| request | `duck` | Lower a level for a while: `{ "target", "by" (dB), "rampMs", "maxMs" }`. The receiver restores it on `unduck`, after `maxMs`, or when the sender leaves the bus. |
| request | `unduck` | `{ "target" }`: end a duck. |
| broadcast | `alert` | `{ "text", "level"?: "info" \| "warn" }`: something every peer may show briefly. |

### actions

Where a peer's actions are visible right now, so plugins can tell who sits next to them, e.g. a Panorama that runs across the dials of two plugins.

```json
{"t":"state","key":"actions","value":[
  {"device":"A1B2…","column":1,"row":0,"controller":"Encoder","action":"de.boriskemper.music-assistant-controller.panorama-dial","effect":"boing-ball"},
  {"device":"A1B2…","column":0,"row":1,"controller":"Keypad","action":"de.boriskemper.xair-controller.channel-key"}
]}
```

- `device` is the Stream Deck device id, `column` and `row` the position, `action` the action's UUID.
- `effect`: the Panorama effect the action shows, if any. `label`: a short name for the dial (a channel, a player). `panoramaMember`: false when the dial doesn't show its row's effect. `liveColor`: the colour the dial puts into its row's effect from outside right now (e.g. a lamp's colour), which wins over the row's colour. Peers may add other fields.
- Only actions on a page that is visible now; not those inside multi-actions. The list changes when the user switches pages, adds or moves actions.
- Neighbours are actions on the same device and of the same controller kind next to each other: left and right, and for keys also up and down.

### covers

The colour of what is playing, so other plugins can use it (a Panorama row's colour, later a key's "on" colour) without their own music source.

```json
{"t":"state","key":"covers","value":[
  {"player":"RINCON_38…","name":"Herrenzimmer","color":"#d9643a","playing":true,"since":1759500000000}
]}
```

- One entry per player the peer knows. `color` is already readable on black (the sender raises the cover's accent colour to a minimum brightness and saturation), so every peer shows the same colour.
- `since` is when the player last started playing; it stays while paused. The **active player** across all peers is the one playing with the highest `since`; when none plays, the one with the highest `since`.
- A choice of colour is written as `cover` (the active player), `cover:<peer name>/<player>` (one player of one peer), `#RRGGBB` (fixed) or `default` (the effect's own colour).

### players

What each peer can play, so any plugin's keys can control any player on the deck: an SO-C user who sets up Music Assistant later finds the same keys already working with MA's players (grill 2026-10-04). `players` is a superset of `covers`; a peer that publishes `players` doesn't need `covers` (peers read both while older versions are around).

```json
{"t":"state","key":"players","value":[
  {"player":"RINCON_000E58CEAB4401400","device":"RINCON_000E58CEAB4401400","name":"Badezimmer","kind":"speaker","direct":true,
   "playing":true,"since":1759500000000,"color":"#d9643a","media":true,
   "title":"Song","artist":"Artist","album":"Album","cover":"http://192.168.7.212:1400/getaa?…",
   "position":42.5,"duration":215,"at":1759500042500,"volume":12,"muted":false,"shuffle":false,"repeat":"off",
   "can":["play-pause","next","previous","seek","volume","mute","shuffle","repeat"],
   "source":"Spotify","sourceIcon":"data:image/png;base64,…","battery":80,"charging":false}
]}
```

- `members` (optional): for a group, the `device`s playing in it, its own included; a key whose choice is `device:<a member>` controls the group.
- `player` is the peer's own id for it. `device` names the physical device when other peers can know it too (a Sonos speaker's `RINCON_…`; Music Assistant uses the same id for Sonos speakers). Entries of different peers with the same `device` are **one player**.
- `kind`: `speaker` (a room, a speaker, a group) or `app` (media on this computer, e.g. a Windows media session). For `app`, `app` names the application ("Spotify"), so a choice survives the app restarting.
- `direct`: the peer talks to the device itself (SO-C for Sonos), not through a server. `media`: what plays right now comes from this peer (its queue or session). One `device` can have two owners, the **device's** peer (`direct`, else the one commands went to before) and the **media's** peer (`media` true, the one that plays first). They split it like this (grill 2026-10-09):

  | From the device's peer | From the media's peer |
  |---|---|
  | `playing` (the device knows: Music Assistant reported a Sonos speaker "playing" all through a pause) | `title`, `artist`, `album`, `cover`, `color`, `position`, `duration`, `at`, `source`, `sourceIcon`, `shuffle`, `repeat` |
  | `volume`, `muted`, `battery`, `charging` | |
  | commands `volume`, `volume-by`, `mute` | commands `play-pause`, `play`, `pause`, `next`, `previous`, `seek`, `shuffle`, `repeat` (Sonos commands break Music Assistant's stream: a second Next leaves the speaker buffering, a Play after a pause ends in silence) |

  `can` follows the same split. Without a `media` peer, or when one peer is both, everything comes from it; without a `direct` peer, a player plays when any peer says so.
- `playing` and `since` as in covers (the active player is the one playing with the highest `since`, else the highest `since`); a peer only counts a player as started after about 2 s of real playback. `color` as in covers, the cover's colour (so it comes with the cover from the media's peer).
- `position` and `duration` in seconds, `at` the time (ms) `position` was true, so others can count on while `playing`. Missing `duration`: nothing to seek (radio, a stream).
- `volume` 0–100, `repeat` `off` | `all` | `one`. `crossfade` and `autoplay` (tracks fade into each other; similar music goes on when the queue ends — Music Assistant's "Don't stop the music"), both `true`/`false`, with the commands of the same names. A group is one entry (its coordinator), named like "Küche + 2".
- `can` lists the commands the player takes now; keys grey out what's missing.
- `source` says for people where what plays comes from ("Spotify", "Sonos Radio", "Line-In", an app's name), `sourceIcon` is a square picture of it (an image URL every plugin on this computer can load, or a `data:` URI). `battery` 0–100 and `charging` for a device that runs on a battery. Keys show them as badges.
- `cover` is a URL every plugin on this computer can load (`http`/`https`). A peer that only has the image's bytes (SA-C: Windows media sessions) serves it itself on `127.0.0.1` (the kit's `CoverServer`).
- Missing fields mean unknown. Peers may add their own fields.

A key stores its player as a **player choice**: `active` (the active speaker), `active:all` (the active player including apps), `device:<device>`, `app:<app>`, or `<peer name>/<player>` for one without either.

The `transport` request asks the peer that owns the player to do something:

```json
{"t":"req","id":9,"method":"transport","params":{"player":"RINCON_000E58CEAB4401400","command":"seek","value":102.5}}
{"t":"res","id":9,"ok":true}
```

| command | value |
|---|---|
| `play-pause`, `play`, `pause`, `next`, `previous` | — |
| `seek` | target position in seconds |
| `volume` | 0–100 |
| `volume-by` | change in steps, e.g. `-2` |
| `mute` | boolean |
| `shuffle` | boolean |
| `repeat` | `off` \| `all` \| `one` |

- `transport` is **accepted by default** from every peer (only the person at this computer sends it, and it does nothing a remote couldn't). A plugin offers a switch to turn it off ("Other plugins may control my players"); then it answers `not allowed`.
- Unknown players or commands the player can't take are refused with an error.

The kit implements both sides as `PlayerBoard` (publish, merge by `device`, active player, choices, routing) and `serveTransport()`.

### panorama

One Panorama effect across adjacent dials of different plugins.

- **The row's colour** is the row setting `rowColor`, a colour choice as in covers (default `cover`). Every peer turns it into the effect's colour fields (`color`, and `primaryColor` / `landColor` where the effect has them) from all peers' `covers`; without a colour the effect's own. Live colours from a dial still win.
- **One effect per row:** all dials of a device form a row with one effect (`effect` "none" for none) and one set of `settings`. Every peer publishes the newest row it knows in `panorama-rows`; a row with a higher `stamp` (ms) wins and is taken over by every peer (the latest choice wins). A dial that doesn't take part (`panoramaMember: false`) stays in the group but draws nothing. Other peers' dials are checked or unchecked with the request `panorama-member`.
- **Groups** are worked out by every peer the same way from all `actions`: dials (`"controller": "Encoder"`) on the same `device` in adjacent columns with the same `effect` form one group, whichever peer they belong to.
- The peer with the group's **leftmost** dial **leads**: it runs the effect over the whole group (its width is all of the group's displays) and publishes every other peer's dial slice on `panorama/<device>/<column>`, one message per effect tick (the latest one wins for a slow subscriber). Settings are merged per key: **live** settings (from outside sources, e.g. a colour or speed from a Home Assistant entity) win over picked ones; within each, the leftmost dial that sets a key wins. The group moves with the highest `level`.
- A peer whose dial is in a group led by someone else does **not** run that group; it subscribes to its dial's topic and draws the slice it gets, with its own foreground (value, ring, name) on top. When the leading peer leaves or the group splits, it runs its dials itself again.
- The following peer sends what its dial puts into the effect on `panorama-in/<device>/<column>`: its picked `settings`, its `live` settings and its `level`, when they change and whenever the leader subscribes (streams aren't kept). The leader feeds them into the group as if the dial were its own.

```json
{"t":"sub","topic":"panorama/A1B2…/2"}
{"t":"pub","topic":"panorama/A1B2…/2","data":"<g>…</g>"}
```

The kit implements both sides as `SharedPanorama` (same API as its `PanoramaEngine`).

### duck

A peer asks another to lower a level for a while, e.g. MA-C during an announcement asks SA-C to lower the computer's sound.

```json
{"t":"req","id":7,"method":"duck","params":{"target":"meters/system-output","by":-12,"rampMs":300,"maxMs":30000}}
{"t":"res","id":7,"ok":true,"result":{"db":-12}}
```

- `target` is one of the receiver's stream topics (the level that moves is the one it shows). Unknown targets are refused (`unknown target …`).
- `by` is in dB, 0 or below; receivers clamp it to −60. `rampMs` (default 300, at most 5000) is the fade; `maxMs` (default 30000, at most 300000) ends the duck by itself. The result is the target's gain now.
- Several peers may duck the same target; the **deepest** one wins. When the last duck ends, the receiver puts the **exact** level from before back.
- The **user wins:** if the user sets the level by hand during a duck, the duck ends there and the user's level stays. The same when the target goes away (another device, a closed app).
- `duck` needs the user's permission per peer (`not allowed` otherwise). `unduck` is always accepted, and taking the permission back ends that peer's ducks.
- A repeated `duck` from the same peer on the same target replaces its earlier one (new `by`, `maxMs` counts again).

The kit implements the receiving side as `DuckLeases` and `serveDucking()`.

## Guarantees and limits

- **Local only:** one computer, one user, at most 16 peers.
- **Equal peers:** there is no master. Tasks that need one decider (e.g. sharing a frame budget) use a fixed rule every peer can compute on its own, such as "the peer with the lowest slot".
- **Optional:** a plugin must work without the bus. If the bus can't start (all slots taken, key unreadable), the plugin carries on alone.
