// "@rocklobster42195/streamdeck-kit/bus": the kit's implementation of deckbus, a local bus between
// Stream Deck plugins (and other local apps). See docs/deckbus-protocol.md.
export { DeckBus, type DeckBusOptions, type PeerInfo } from "./bus.js";
export { PROTOCOL_VERSIONS, type BusMessage, type Hello } from "./protocol.js";
export { defaultKeyDir, slotAddress, userTag } from "./paths.js";
