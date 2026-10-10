// The plugin side of the property inspector: knows which PI is open, answers the kit's requests
// ("pi-ready", "options"), and pushes the plugin's state to the open PI — only what changed.
// Plugins add their own requests with handle() and their own state with addPusher().
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { kitLog } from "./log.js";
import type { KitPiPush, KitPiRequest, OptionItem } from "./protocol.js";

/** Provides a list for the PI; `params` come from the requesting component (e.g. a player id). */
export type OptionsProvider = (params: Record<string, string>) => Promise<OptionItem[]> | OptionItem[];

/** Handles one PI request event of the plugin's own protocol. */
export type PiRequestHandler = (msg: JsonObject & { event: string }, actionId: string) => void | Promise<void>;

/** A message the plugin pushes to the PI; pushes are deduplicated per `event`. */
export type PiPushMessage = JsonObject & { event: string };

export class PiBridge {
    private visibleActionId: string | undefined;
    private readonly previews = new Map<string, unknown>();
    private readonly lastSent = new Map<string, string>();
    private readonly optionProviders = new Map<string, OptionsProvider>();
    private readonly handlers = new Map<string, PiRequestHandler>();
    private readonly pushers: (() => PiPushMessage[])[] = [];
    private pushTimer: ReturnType<typeof setTimeout> | undefined;

    /** The action whose PI is open, if any. */
    get visibleAction(): string | undefined {
        return this.visibleActionId;
    }

    /** Make a named list available to PI components (`<pi-select source="…">`, `<pi-icon-picker>`). */
    registerOptions(source: string, provider: OptionsProvider): void {
        this.optionProviders.set(source, provider);
    }

    /** Handle a request event of the plugin's own protocol. */
    handle(event: string, handler: PiRequestHandler): void {
        this.handlers.set(event, handler);
    }

    /** State pushed to the open PI when it opens and after schedulePush(); unchanged messages are skipped. */
    addPusher(pusher: () => PiPushMessage[]): void {
        this.pushers.push(pusher);
    }

    init(): void {
        streamDeck.ui.onDidAppear((ev) => {
            this.visibleActionId = ev.action.id;
            this.lastSent.clear();
        });
        streamDeck.ui.onDidDisappear((ev) => {
            if (this.visibleActionId === ev.action.id) this.visibleActionId = undefined;
        });
        streamDeck.ui.onSendToPlugin((ev) => void this.dispatch(ev.payload as JsonObject & { event: string }, ev.action.id));
    }

    /** Actions report what their key shows; forwarded when that action's PI is open. */
    updatePreview(actionId: string, preview: unknown): void {
        this.previews.set(actionId, preview);
        if (actionId === this.visibleActionId) void this.send(previewMessage(preview));
    }

    forget(actionId: string): void {
        this.previews.delete(actionId);
    }

    /** Push the plugin's state soon; bursts of changes are coalesced into one update. */
    schedulePush(): void {
        if (!this.visibleActionId || this.pushTimer) return;
        this.pushTimer = setTimeout(() => {
            this.pushTimer = undefined;
            this.pushAll();
        }, 200);
    }

    /** Answer a request; answers are never deduplicated. */
    async reply(msg: PiPushMessage): Promise<void> {
        await streamDeck.ui.sendToPropertyInspector(msg);
    }

    private async dispatch(msg: (JsonObject & { event: string }) | undefined, actionId: string): Promise<void> {
        const kit = msg as KitPiRequest | undefined;
        try {
            if (kit?.event === "pi-ready") {
                this.visibleActionId = actionId;
                this.lastSent.clear();
                this.pushAll();
            } else if (kit?.event === "options") {
                await this.answerOptions(kit.requestId, kit.source, kit.params ?? {});
            } else if (msg?.event) {
                await this.handlers.get(msg.event)?.(msg, actionId);
            }
        } catch (e) {
            kitLog().warn(`[pi] request "${msg?.event}" failed`, e);
        }
    }

    private async answerOptions(requestId: number, source: string, params: Record<string, string>): Promise<void> {
        let reply: KitPiPush;
        try {
            const provider = this.optionProviders.get(source);
            if (!provider) throw new Error(`unknown option source "${source}"`);
            reply = { event: "options-result", requestId, source, items: await provider(params) };
        } catch (e) {
            reply = { event: "options-result", requestId, source, items: [], error: String((e as Error)?.message ?? e) };
        }
        await this.reply(reply as unknown as PiPushMessage);
    }

    private pushAll(): void {
        if (!this.visibleActionId) return;
        for (const pusher of this.pushers) for (const msg of pusher()) void this.send(msg);
        const preview = this.previews.get(this.visibleActionId);
        if (preview) void this.send(previewMessage(preview));
    }

    private async send(msg: PiPushMessage): Promise<void> {
        const json = JSON.stringify(msg);
        if (this.lastSent.get(msg.event) === json) return;
        this.lastSent.set(msg.event, json);
        await streamDeck.ui.sendToPropertyInspector(msg);
    }
}

/** The plugin's one bridge to its property inspectors. */
export const piBridge = new PiBridge();

function previewMessage(preview: unknown): PiPushMessage {
    return { event: "preview", preview } as unknown as PiPushMessage;
}

// Diagnostics: the log tail and report header for the settings window
export { registerDiagnostics, tailLines, reportHeader, reportText, copyToClipboard, defaultLogFile, revealFile, type DiagnosticsOptions } from "./diagnostics.js";
export { redactLog } from "./redact.js";

// Also on the SDK side: deckbus' "actions" state from the plugin's visible actions
export { trackActions, type DescribeAction } from "./track-actions.js";
