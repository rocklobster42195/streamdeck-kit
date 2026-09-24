// Minimal Stream Deck property inspector client (replaces sdpi-components).
// Stream Deck calls window.connectElgatoStreamDeckSocket(...) when the PI loads; we open the
// WebSocket, register, and expose settings/global settings/messages to the components.

type JsonObject = Record<string, unknown>;
type Listener<T> = (value: T) => void;

export interface ActionInfo {
    action: string;
    context: string;
    device: string;
    payload: { settings: JsonObject; coordinates?: { column: number; row: number }; controller?: string };
}

export interface RegistrationInfo {
    application: { language: string; platform: string; version: string };
    plugin: { uuid: string; version: string };
    [key: string]: unknown;
}

export class StreamDeckPiClient {
    settings: JsonObject = {};
    globalSettings: JsonObject = {};
    actionInfo: ActionInfo | undefined;
    info: RegistrationInfo | undefined;

    private ws: WebSocket | undefined;
    private uuid = '';
    private ready = false;
    private readonly listeners = {
        ready: new Set<Listener<void>>(),
        settings: new Set<Listener<JsonObject>>(),
        globalSettings: new Set<Listener<JsonObject>>(),
        message: new Set<Listener<any>>(),
    };

    get language(): string {
        return (this.info?.application.language ?? navigator.language ?? 'en').split(/[-_]/)[0].toLowerCase();
    }

    connect(port: number, uuid: string, registerEvent: string, info: string, actionInfo: string): void {
        this.uuid = uuid;
        this.info = safeParse(info);
        this.actionInfo = safeParse(actionInfo);
        this.settings = { ...(this.actionInfo?.payload.settings ?? {}) };

        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        this.ws = ws;
        ws.addEventListener('open', () => {
            ws.send(JSON.stringify({ event: registerEvent, uuid }));
            this.send({ event: 'getGlobalSettings', context: uuid });
        });
        ws.addEventListener('message', (ev) => this.handle(safeParse(String(ev.data))));
    }

    /** Resolves once settings and global settings are known. */
    onReady(fn: () => void): void {
        if (this.ready) fn();
        else this.listeners.ready.add(fn);
    }

    onSettings(fn: Listener<JsonObject>): () => void {
        this.listeners.settings.add(fn);
        return () => this.listeners.settings.delete(fn);
    }

    onGlobalSettings(fn: Listener<JsonObject>): () => void {
        this.listeners.globalSettings.add(fn);
        return () => this.listeners.globalSettings.delete(fn);
    }

    /** Messages from the plugin (sendToPropertyInspector). */
    onMessage(fn: Listener<any>): () => void {
        this.listeners.message.add(fn);
        return () => this.listeners.message.delete(fn);
    }

    setSetting(key: string, value: unknown): void {
        this.settings = { ...this.settings, [key]: value };
        this.send({ event: 'setSettings', context: this.uuid, payload: this.settings });
        this.emit('settings', this.settings);
    }

    setGlobalSetting(key: string, value: unknown): void {
        this.globalSettings = { ...this.globalSettings, [key]: value };
        this.send({ event: 'setGlobalSettings', context: this.uuid, payload: this.globalSettings });
        this.emit('globalSettings', this.globalSettings);
    }

    /** Open a URL in the system browser (links inside the PI would navigate the PI itself). */
    openUrl(url: string): void {
        this.send({ event: 'openUrl', payload: { url } });
    }

    sendToPlugin(payload: JsonObject): void {
        this.send({ event: 'sendToPlugin', action: this.actionInfo?.action, context: this.uuid, payload });
    }

    private send(msg: JsonObject): void {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    }

    private handle(msg: any): void {
        if (!msg) return;
        switch (msg.event) {
            case 'didReceiveSettings':
                this.settings = { ...(msg.payload?.settings ?? {}) };
                this.emit('settings', this.settings);
                break;
            case 'didReceiveGlobalSettings':
                this.globalSettings = { ...(msg.payload?.settings ?? {}) };
                this.emit('globalSettings', this.globalSettings);
                if (!this.ready) {
                    this.ready = true;
                    for (const fn of this.listeners.ready) fn();
                    this.listeners.ready.clear();
                }
                break;
            case 'sendToPropertyInspector':
                this.emit('message', msg.payload);
                break;
        }
    }

    private emit<K extends keyof StreamDeckPiClient['listeners']>(kind: K, value: any): void {
        for (const fn of this.listeners[kind] as Set<Listener<any>>) {
            try {
                fn(value);
            } catch (e) {
                console.error(`[pi] ${kind} listener failed`, e);
            }
        }
    }
}

function safeParse(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

export const sd = new StreamDeckPiClient();

(window as any).connectElgatoStreamDeckSocket = (port: number, uuid: string, registerEvent: string, info: string, actionInfo: string) =>
    sd.connect(port, uuid, registerEvent, info, actionInfo);
