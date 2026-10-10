// The plugin side of "Diagnostics" in the settings window (grill 2026-10-10): the PI asks for the
// end of this plugin's log file and a report header, and can have the file shown in the file
// manager. Everything is redacted (redact.ts) before it leaves the plugin. Used by the PI's
// <pi-diagnostics>; a plugin only calls registerDiagnostics() once at startup.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import streamDeck from '@elgato/streamdeck';
import { kitLog } from './log.js';
import type { PiBridge } from './pi-bridge.js';
import { redactLog } from './redact.js';
import { KIT_VERSION } from './version.js';

export type DiagnosticsOptions = {
    /** The plugin repo's issue page (opened by "Report an issue"). */
    issueUrl?: string;
    /** The other plugins on deckbus, for the report's header. */
    peers?: () => { name: string; version: string }[];
    /** Anything else worth a header line (connection states, counts). */
    extra?: () => Record<string, string | number | boolean | undefined>;
    /** The log file; default `<plugin>.sdPlugin/logs/<uuid>.0.log` next to the running bundle. */
    logFile?: string;
    /** How many of the log's last lines to give (default 150). */
    lines?: number;
};

const TAIL_BYTES = 128 * 1024;

/** The default log file of this plugin (Stream Deck writes `logs/<plugin uuid>.0.log` beside `bin/`). */
export function defaultLogFile(): string {
    const bundle = path.dirname(fileURLToPath(import.meta.url));
    const uuid = (streamDeck.info.plugin as { uuid?: string }).uuid ?? 'plugin';
    return path.resolve(bundle, '..', 'logs', `${uuid}.0.log`);
}

/** The last `count` lines of a file (its last 128 KB), redacted. */
export function tailLines(file: string, count: number): string[] {
    const data = fs.readFileSync(file);
    const start = Math.max(0, data.length - TAIL_BYTES);
    let lines = data.subarray(start).toString('utf8').split(/\r?\n/);
    if (start > 0) lines = lines.slice(1); // the first one is cut
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.slice(-count).map(redactLog);
}

/** The report's header lines. */
export function reportHeader(o: DiagnosticsOptions): string[] {
    const info = streamDeck.info as { plugin: { version?: string; uuid?: string }; application: { version?: string; platform?: string; language?: string } };
    const peers = o.peers?.() ?? [];
    const lines = [
        `Plugin: ${info.plugin.uuid ?? '?'} ${info.plugin.version ?? ''}`.trim(),
        `Kit: ${KIT_VERSION}`,
        `Stream Deck: ${info.application.version ?? '?'} (${info.application.platform ?? process.platform}, ${info.application.language ?? '?'})`,
        `System: ${os.type()} ${os.release()} ${os.arch()}, Node ${process.versions.node}`,
        `Plugins on deckbus: ${peers.length ? peers.map((p) => `${p.name} ${p.version}`).join(', ') : 'none'}`,
    ];
    for (const [k, v] of Object.entries(o.extra?.() ?? {})) if (v !== undefined) lines.push(`${k}: ${v}`);
    return lines.map(redactLog);
}

/** Shows a file in the file manager, selected (Explorer, Finder); elsewhere its folder. */
export function revealFile(file: string): void {
    const spawnQuiet = (cmd: string, args: string[], opts: Record<string, unknown> = {}) => {
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore', ...opts });
        child.on('error', (e) => kitLog().warn('[diagnostics] could not open the file manager', e));
        child.unref();
    };
    if (process.platform === 'win32') spawnQuiet('explorer.exe', [`/select,"${file}"`], { windowsVerbatimArguments: true });
    else if (process.platform === 'darwin') spawnQuiet('open', ['-R', file]);
    else spawnQuiet('xdg-open', [path.dirname(file)]);
}

/**
 * Answers the PI's "kit-diag-request" (log tail and report header) and "kit-diag-open" (show the
 * log file). The file path never comes from the PI.
 */
export function registerDiagnostics(bridge: PiBridge, o: DiagnosticsOptions = {}): void {
    const file = () => o.logFile ?? defaultLogFile();
    bridge.handle('kit-diag-request', async () => {
        let lines: string[] = [];
        let error: string | undefined;
        try {
            lines = tailLines(file(), o.lines ?? 150);
        } catch (e) {
            error = String((e as Error)?.message ?? e);
        }
        await bridge.reply({ event: 'kit-diag', header: reportHeader(o), lines, issueUrl: o.issueUrl ?? '', ...(error ? { error } : {}) });
    });
    bridge.handle('kit-diag-open', () => {
        try {
            revealFile(file());
        } catch (e) {
            kitLog().warn('[diagnostics] could not show the log file', e);
        }
    });
}
