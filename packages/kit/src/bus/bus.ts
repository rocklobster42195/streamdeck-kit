// deckbus: a local bus between Stream Deck plugins (and any other local app), without a master.
// Every peer takes a free slot (0–15) and listens there; the peer in the higher slot connects to
// the lower one, so every pair has one connection. Each peer owns its state and sends it again
// after every (re)connect. See docs/deckbus-protocol.md.
import fs from "node:fs";
import net from "node:net";
import { kitLog } from "../log.js";
import { PeerConnection, type PeerInfo } from "./connection.js";
import { readOrCreateKey, slotAddress } from "./paths.js";
import { PROTOCOL_VERSIONS, type BusMessage, type Hello } from "./protocol.js";

export type { PeerInfo };

export type DeckBusOptions = {
    /** The plugin's UUID, e.g. "de.boriskemper.xair-controller". */
    id: string;
    /** Short name, e.g. "XR-C". */
    name: string;
    version: string;
    caps?: string[];
    /** "deckbus"; tests use their own so they never meet real plugins. */
    namespace?: string;
    slots?: number;
    /** How often to look for new peers in lower slots (default 5000 ms). */
    scanMs?: number;
    keyDir?: string;
    /** Default timeout for requests (3000 ms). */
    timeoutMs?: number;
    /** For tests: the protocol versions to offer. */
    protocolVersions?: number[];
};

type Allow = (peer: PeerInfo) => boolean;
type Handler = (params: unknown, peer: PeerInfo) => unknown;
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; conn: PeerConnection };

export class DeckBus {
    private server: net.Server | undefined;
    private slotNo = -1;
    private key = "";
    private scanTimer: ReturnType<typeof setInterval> | undefined;
    private readonly conns = new Set<PeerConnection>();
    private readonly connecting = new Set<number>();
    private readonly state = new Map<string, unknown>();
    private readonly localSubs = new Map<string, Set<(data: unknown, from: PeerInfo) => void>>();
    private readonly subscriberWatchers = new Map<string, Set<(count: number) => void>>();
    private readonly handlers = new Map<string, { fn: Handler; allow: Allow }>();
    private readonly broadcastListeners = new Map<string, Set<(data: unknown, from: PeerInfo) => void>>();
    private readonly peerListeners = new Set<(peers: PeerInfo[]) => void>();
    private readonly pending = new Map<number, Pending>();
    private nextId = 0;

    constructor(private readonly o: DeckBusOptions) {}

    /** The slot this peer took, or -1 while not running. */
    get slot(): number {
        return this.slotNo;
    }

    /** Join the bus. Never throws: without a bus the plugin simply works on its own (logged). */
    async start(): Promise<boolean> {
        try {
            this.key = await readOrCreateKey(this.o.keyDir);
            this.server = await this.claimSlot();
            if (!this.server) {
                kitLog().warn("[deckbus] all slots taken, working without the bus");
                return false;
            }
            this.server.on("connection", (socket) => this.adopt(socket));
            this.scan();
            this.scanTimer = setInterval(() => this.scan(), this.o.scanMs ?? 5000);
            return true;
        } catch (e) {
            kitLog().warn("[deckbus] could not start, working without the bus", e);
            return false;
        }
    }

    stop(): void {
        clearInterval(this.scanTimer);
        for (const c of [...this.conns]) c.close("stopped");
        this.server?.close();
        this.server = undefined;
        if (process.platform !== "win32" && this.slotNo >= 0) fs.rmSync(slotAddress(this.slotNo, this.o.namespace), { force: true });
        this.slotNo = -1;
    }

    // ---- peers and state ----

    peers(): PeerInfo[] {
        return [...this.conns].filter((c) => c.ready).map((c) => c.info!);
    }

    /** Called with the current peers now and whenever a peer comes, goes or changes its state. */
    onPeers(fn: (peers: PeerInfo[]) => void): () => void {
        this.peerListeners.add(fn);
        fn(this.peers());
        return () => this.peerListeners.delete(fn);
    }

    /** Own state, e.g. setState("status", { online: true }); undefined/null removes the key. */
    setState(key: string, value: unknown): void {
        if (value === undefined || value === null) this.state.delete(key);
        else this.state.set(key, value);
        this.toAll({ t: "state", key, value: value ?? null });
    }

    // ---- streams ----

    subscribe(topic: string, fn: (data: unknown, from: PeerInfo) => void): () => void {
        let set = this.localSubs.get(topic);
        if (!set) {
            this.localSubs.set(topic, (set = new Set()));
            this.toAll({ t: "sub", topic });
        }
        set.add(fn);
        return () => {
            const s = this.localSubs.get(topic);
            if (!s?.delete(fn) || s.size) return;
            this.localSubs.delete(topic);
            this.toAll({ t: "unsub", topic });
        };
    }

    /** Send stream data to the peers subscribed to `topic` (latest value wins when a peer is slow). */
    publish(topic: string, data: unknown): void {
        for (const c of this.conns) if (c.ready && c.subs.has(topic)) c.sendLatest(topic, { t: "pub", topic, data });
    }

    /** How many peers subscribe to `topic`: now, and on every change (e.g. to start or stop a source). */
    onSubscribers(topic: string, fn: (count: number) => void): () => void {
        let set = this.subscriberWatchers.get(topic);
        if (!set) this.subscriberWatchers.set(topic, (set = new Set()));
        set.add(fn);
        fn(this.subscriberCount(topic));
        return () => set!.delete(fn);
    }

    // ---- requests ----

    /** Answer requests for `method`; `allow` decides per peer (writes should allow only chosen peers). */
    handle(method: string, fn: Handler, allow: Allow): void {
        this.handlers.set(method, { fn, allow });
    }

    /**
     * Ask a peer: by plugin UUID, or a PeerInfo from peers() when two peers share an id (e.g. a
     * plugin in the simulator next to the same plugin in Stream Deck). Rejects on "not allowed",
     * errors, a missing peer or the timeout.
     */
    request(peer: string | PeerInfo, method: string, params?: unknown, timeoutMs = this.o.timeoutMs ?? 3000): Promise<unknown> {
        const peerId = typeof peer === "string" ? peer : peer.id;
        const conn = [...this.conns].find((c) => c.ready && c.info!.id === peerId && (typeof peer === "string" || c.info!.slot === peer.slot));
        if (!conn) return Promise.reject(new Error(`no peer ${peerId}`));
        const id = ++this.nextId;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`${method}: no answer from ${peerId}`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer, conn });
            conn.send({ t: "req", id, method, params });
        });
    }

    // ---- broadcast ----

    broadcast(event: string, data?: unknown): void {
        this.toAll({ t: "bc", event, data });
    }

    onBroadcast(event: string, fn: (data: unknown, from: PeerInfo) => void): () => void {
        let set = this.broadcastListeners.get(event);
        if (!set) this.broadcastListeners.set(event, (set = new Set()));
        set.add(fn);
        return () => set!.delete(fn);
    }

    // ---- connections ----

    private async claimSlot(): Promise<net.Server | undefined> {
        for (let slot = 0; slot < (this.o.slots ?? 16); slot++) {
            const address = slotAddress(slot, this.o.namespace);
            let server = await listen(address);
            if (!server && process.platform !== "win32" && !(await alive(address))) {
                // A socket file left behind by a crashed peer: take the slot over
                fs.rmSync(address, { force: true });
                server = await listen(address);
            }
            if (server) {
                this.slotNo = slot;
                return server;
            }
        }
        return undefined;
    }

    /** Connect to every lower slot we have no connection to (the higher slot always dials). */
    private scan(): void {
        for (let slot = 0; slot < this.slotNo; slot++) {
            if (this.connecting.has(slot) || [...this.conns].some((c) => c.info?.slot === slot)) continue;
            this.connecting.add(slot);
            const socket = net.connect(slotAddress(slot, this.o.namespace));
            socket.once("connect", () => {
                this.connecting.delete(slot);
                this.adopt(socket);
            });
            socket.once("error", () => {
                this.connecting.delete(slot);
                socket.destroy();
            });
        }
    }

    private adopt(socket: net.Socket): void {
        const conn = new PeerConnection(socket, this.hello(), {
            ready: (c) => this.ready(c),
            message: (c, m) => this.receive(c, m),
            closed: (c, reason) => this.closed(c, reason),
        });
        this.conns.add(conn);
    }

    private hello(): Hello {
        return { t: "hello", proto: this.o.protocolVersions ?? PROTOCOL_VERSIONS, id: this.o.id, name: this.o.name, version: this.o.version, caps: this.o.caps ?? [], slot: this.slotNo, key: this.key };
    }

    private ready(conn: PeerConnection): void {
        // A peer that reconnects replaces its old connection
        for (const c of this.conns) if (c !== conn && c.info?.slot === conn.info!.slot && c.info.id === conn.info!.id) c.close("replaced");
        for (const [key, value] of this.state) conn.send({ t: "state", key, value });
        for (const topic of this.localSubs.keys()) conn.send({ t: "sub", topic });
        this.emitPeers();
    }

    private receive(conn: PeerConnection, msg: BusMessage): void {
        const peer = conn.info!;
        switch (msg.t) {
            case "state":
                if (msg.value === null) delete peer.state[msg.key];
                else peer.state[msg.key] = msg.value;
                this.emitPeers();
                break;
            case "sub":
                conn.subs.add(msg.topic);
                this.emitSubscribers(msg.topic);
                break;
            case "unsub":
                conn.subs.delete(msg.topic);
                this.emitSubscribers(msg.topic);
                break;
            case "pub":
                for (const fn of this.localSubs.get(msg.topic) ?? []) fn(msg.data, peer);
                break;
            case "req":
                void this.answer(conn, msg.id, msg.method, msg.params);
                break;
            case "res": {
                const p = this.pending.get(msg.id);
                if (!p || p.conn !== conn) break;
                this.pending.delete(msg.id);
                clearTimeout(p.timer);
                if (msg.ok) p.resolve(msg.result);
                else p.reject(new Error(msg.error ?? "failed"));
                break;
            }
            case "bc":
                for (const fn of this.broadcastListeners.get(msg.event) ?? []) fn(msg.data, peer);
                break;
            case "bye":
                kitLog().warn(`[deckbus] ${peer.name} closed the connection: ${msg.reason}`);
                break;
        }
    }

    private async answer(conn: PeerConnection, id: number, method: string, params: unknown): Promise<void> {
        const peer = conn.info!;
        const h = this.handlers.get(method);
        if (!h) return conn.send({ t: "res", id, ok: false, error: `unknown method ${method}` });
        if (!h.allow(peer)) return conn.send({ t: "res", id, ok: false, error: "not allowed" });
        try {
            conn.send({ t: "res", id, ok: true, result: await h.fn(params, peer) });
        } catch (e) {
            conn.send({ t: "res", id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
    }

    private closed(conn: PeerConnection, reason: string): void {
        const was = this.conns.delete(conn) && !!conn.info;
        for (const [id, p] of this.pending) {
            if (p.conn !== conn) continue;
            clearTimeout(p.timer);
            this.pending.delete(id);
            p.reject(new Error(`peer left (${reason})`));
        }
        for (const topic of conn.subs) this.emitSubscribers(topic);
        if (was) this.emitPeers();
    }

    private toAll(msg: BusMessage): void {
        for (const c of this.conns) if (c.ready) c.send(msg);
    }

    private subscriberCount(topic: string): number {
        return [...this.conns].filter((c) => c.ready && c.subs.has(topic)).length;
    }

    private emitSubscribers(topic: string): void {
        const count = this.subscriberCount(topic);
        for (const fn of this.subscriberWatchers.get(topic) ?? []) fn(count);
    }

    private emitPeers(): void {
        const peers = this.peers();
        for (const fn of this.peerListeners) fn(peers);
    }
}

/** A server listening on `address`, or undefined when the address is taken. */
function listen(address: string): Promise<net.Server | undefined> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(undefined));
        server.listen(address, () => resolve(server));
    });
}

/** Whether something answers on a Unix socket (a dead one refuses). */
function alive(address: string): Promise<boolean> {
    return new Promise((resolve) => {
        const s = net.connect(address);
        s.once("connect", () => {
            s.destroy();
            resolve(true);
        });
        s.once("error", () => resolve(false));
    });
}
