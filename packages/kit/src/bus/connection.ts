// One connection to one peer: sends our hello, checks theirs (key, common version), frames
// messages, and sends stream data "latest value wins" when the socket is backed up.
import type net from "node:net";
import { commonVersion, LineReader, type BusMessage, type Hello } from "./protocol.js";

export type PeerInfo = {
    /** The peer's plugin UUID. */
    id: string;
    name: string;
    version: string;
    caps: string[];
    slot: number;
    /** The protocol version both sides agreed on. */
    protocol: number;
    /** The peer's own state (its keys only; gone when it goes). */
    state: Record<string, unknown>;
};

type Handlers = {
    ready(conn: PeerConnection): void;
    message(conn: PeerConnection, msg: BusMessage): void;
    closed(conn: PeerConnection, reason: string): void;
};

const HELLO_TIMEOUT_MS = 3000;

export class PeerConnection {
    info: PeerInfo | undefined;
    /** Topics the peer subscribed to from us. */
    readonly subs = new Set<string>();
    private readonly reader = new LineReader();
    private readonly pending = new Map<string, BusMessage>();
    private closed = false;
    private readonly helloTimer: ReturnType<typeof setTimeout>;

    constructor(
        readonly socket: net.Socket,
        private readonly hello: Hello,
        private readonly handlers: Handlers,
    ) {
        socket.setNoDelay(true);
        socket.on("data", (chunk) => {
            for (const msg of this.reader.push(chunk)) this.receive(msg);
        });
        socket.on("drain", () => this.flush());
        socket.on("error", () => this.close("socket error"));
        socket.on("close", () => this.close("closed"));
        this.helloTimer = setTimeout(() => this.close("no hello"), HELLO_TIMEOUT_MS);
        this.send(hello);
    }

    get ready(): boolean {
        return !!this.info && !this.closed;
    }

    send(msg: BusMessage): void {
        if (this.closed) return;
        this.socket.write(`${JSON.stringify(msg)}\n`);
    }

    /** Stream data: while the socket is backed up, only the latest value per topic is kept. */
    sendLatest(topic: string, msg: BusMessage): void {
        if (this.closed) return;
        if (this.socket.writableNeedDrain) this.pending.set(topic, msg);
        else this.send(msg);
    }

    close(reason: string): void {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.helloTimer);
        this.socket.destroy();
        this.handlers.closed(this, reason);
    }

    private flush(): void {
        const msgs = [...this.pending.values()];
        this.pending.clear();
        for (const m of msgs) this.send(m);
    }

    private receive(msg: BusMessage): void {
        if (this.info) {
            this.handlers.message(this, msg);
            return;
        }
        // The first message must be a valid hello with our key and a common version
        if (msg.t !== "hello") return this.refuse("expected hello");
        if (msg.key !== this.hello.key) return this.refuse("wrong key");
        const protocol = commonVersion(this.hello.proto, msg.proto);
        if (protocol === undefined) return this.refuse(`no common protocol version (ours ${this.hello.proto.join(",")}, theirs ${String(msg.proto)})`);
        clearTimeout(this.helloTimer);
        this.info = { id: String(msg.id), name: String(msg.name), version: String(msg.version), caps: Array.isArray(msg.caps) ? msg.caps.map(String) : [], slot: Number(msg.slot), protocol, state: {} };
        this.handlers.ready(this);
    }

    private refuse(reason: string): void {
        this.send({ t: "bye", reason });
        this.close(reason);
    }
}
