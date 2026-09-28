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
| state | `streams` | Streams the peer offers: `[{ "topic": "meters/ch09", "label": "Sonos", "stereo": true }]`. |
| topic | `meters/<name>` | Audio levels in dBFS with one decimal, about 20 per second: `{ "l": -18.5, "r": -20.1 }`; mono sends only `l`. |
| request | `duck` | Lower a level for a while: `{ "target", "by" (dB), "rampMs", "maxMs" }`. The receiver restores it on `unduck`, after `maxMs`, or when the sender leaves the bus. |
| request | `unduck` | `{ "target" }`: end a duck. |
| broadcast | `alert` | `{ "text", "level"?: "info" \| "warn" }`: something every peer may show briefly. |

## Guarantees and limits

- **Local only:** one computer, one user, at most 16 peers.
- **Equal peers:** there is no master. Tasks that need one decider (e.g. sharing a frame budget) use a fixed rule every peer can compute on its own, such as "the peer with the lowest slot".
- **Optional:** a plugin must work without the bus. If the bus can't start (all slots taken, key unreadable), the plugin carries on alone.
