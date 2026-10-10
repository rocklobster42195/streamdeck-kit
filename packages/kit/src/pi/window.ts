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
let helpUrl = '';

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
export function initSettingsWindow(options: { name: string; helpUrl?: string }): void {
    pluginName = options.name;
    helpUrl = options.helpUrl ?? '';
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
 * "Log" in the page's footer, left of "Help & feedback": in the PI it opens the settings window at
 * the Diagnostics field, in the window it scrolls there and opens it.
 */
function addLogLink(): void {
    const footer = document.querySelector('.pi-footer');
    if (!footer || footer.querySelector('.pi-footer-log')) return;
    const link = document.createElement('a');
    link.href = '#diagnostics';
    link.className = 'pi-footer-log';
    link.textContent = t('kit.diag_log');
    link.addEventListener('click', (e) => {
        e.preventDefault();
        if (isSettingsWindow()) jumpToDiagnostics();
        else if (!openSettingsWindow('diagnostics')) showSettingsInline();
    });
    // "Help & feedback", when the plugin gave an address and the page has no such link yet
    let first = footer.querySelector('a');
    if (!first && helpUrl) {
        const help = document.createElement('a');
        help.href = helpUrl;
        help.textContent = t('kit.help');
        // A link inside the PI would navigate the PI itself
        help.addEventListener('click', (e) => {
            e.preventDefault();
            sd.openUrl(helpUrl);
        });
        footer.appendChild(help);
        first = help;
    }
    // Beside "Help & feedback" on the right (the footer spreads its children across the width)
    if (first) {
        const group = document.createElement('span');
        group.className = 'pi-footer-links';
        footer.insertBefore(group, first);
        group.append(link, first);
    } else footer.appendChild(link);
}

/**
 * Opens the Diagnostics field and brings it into view. Done again a moment later: the page's lists
 * fill in after it was built, and the field moves down with them.
 */
function jumpToDiagnostics(): void {
    const go = () => {
        const section = document.getElementById('diagnostics');
        const details = section?.querySelector('details');
        if (details && !details.open) details.open = true;
        section?.scrollIntoView();
    };
    go();
    setTimeout(go, 300);
    setTimeout(go, 1200);
}

/** The window ends with the "Diagnostics" field (log, copy, issue); a page can place its own `<pi-diagnostics>` instead. */
function addDiagnostics(): void {
    if (document.querySelector('pi-diagnostics') || !customElements.get('pi-diagnostics')) return;
    const section = document.createElement('pi-section');
    section.setAttribute('title', 'kit.diag_title');
    section.id = 'diagnostics';
    section.appendChild(document.createElement('pi-diagnostics'));
    const footer = document.querySelector('.pi-footer');
    if (footer?.parentElement) footer.parentElement.insertBefore(section, footer);
    else document.body.appendChild(section);
}

/**
 * Call once the page is built and shown. In the window: the menu, the title bar ("<plugin> ·
 * <body data-title>") and the section asked for (#id).
 */
export function settingsWindowShown(): void {
    addLogLink();
    if (!isSettingsWindow()) return;
    // <body data-title="i18n key">, else the page's own <title>
    const title = document.body.dataset.title ? t(document.body.dataset.title) : document.title;
    document.title = [pluginName, title].filter(Boolean).join(' · ');
    addDiagnostics();
    initWindowNav();
    if (location.hash === '#diagnostics') jumpToDiagnostics();
    else if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}
