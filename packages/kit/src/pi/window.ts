// The settings window: a short property inspector with the essentials, and everything else in a
// bigger window. The PI opens its own page again with "?window" (window.open; a page from the
// plugin folder, no web server). Stream Deck only connects the PI, so the window borrows the PI's
// connection through window.opener: its `sd` mirrors the PI's settings and messages and sends
// through it. The window closes with the PI (when another key is clicked). Stream Deck opens such
// windows at 500 × 650 and ignores sizes and resizeTo.
//
// In the page: elements with class "pi-win" show only in the window, "pi-pi-only" only in the PI;
// <pi-more> is the PI's button into the window. Without a window (it couldn't open) the PI shows
// everything inline. The window gets a menu with scroll spy (window-nav.ts).
//
//   initSettingsWindow({ name: "HA-C" })     before the page is built (registers, mirrors)
//   settingsWindowShown()                    once the page is built (menu, title, #section)
import { sd, type StreamDeckPiClient } from './sd-client.js';
import { nextRequestId } from './requests.js';
import { t } from './i18n.js';
import { initWindowNav } from './window-nav.js';

const WINDOW_FEATURES = 'width=780,height=860';

let pluginName = '';

export function isSettingsWindow(): boolean {
    return new URLSearchParams(location.search).has('window');
}

/** No window: show the window-only parts in the PI itself. */
export function showSettingsInline(): void {
    document.body.classList.add('pi-inline');
}

/**
 * Open this page as the settings window, scrolled to `section` (an element id). False when it
 * can't open; then call showSettingsInline().
 */
export function openSettingsWindow(section?: string): boolean {
    const url = `${location.pathname.split('/').pop()}?window${section ? `#${section}` : ''}`;
    let w: Window | null = null;
    try {
        w = window.open(url, `settings-${sd.context}`, WINDOW_FEATURES);
    } catch {
        w = null;
    }
    w?.focus();
    return !!w;
}

/**
 * Call when the page script starts. In the PI: lets a window find this page's connection. In the
 * window: mirrors the PI's `sd` (or says to open it from Stream Deck when there is no PI).
 */
export function initSettingsWindow(options: { name: string }): void {
    pluginName = options.name;
    if (!isSettingsWindow()) {
        (window as unknown as { piSettingsSd: StreamDeckPiClient }).piSettingsSd = sd;
        return;
    }
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('pi-window');
        const remote = (window.opener as { piSettingsSd?: StreamDeckPiClient } | null)?.piSettingsSd;
        if (!remote) {
            document.body.hidden = false;
            document.body.innerHTML = `<p class="pi-hint pi-window-alone">${t('kit.window_alone')}</p>`;
            return;
        }
        // Request ids come from a counter per page; keep the window's apart from the PI's
        for (let i = 0; i < 1_000_000; i++) nextRequestId();
        const off = sd.mirror(remote);
        // The PI's listeners would call into a closed window otherwise
        window.addEventListener('pagehide', off);
    });
}

/**
 * Call once the page is built and shown. In the window: the menu, the title bar ("<plugin> ·
 * <body data-title>") and the section asked for (#id).
 */
export function settingsWindowShown(): void {
    if (!isSettingsWindow()) return;
    // <body data-title="i18n key">, else the page's own <title>
    const title = document.body.dataset.title ? t(document.body.dataset.title) : document.title;
    document.title = [pluginName, title].filter(Boolean).join(' · ');
    initWindowNav();
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}
