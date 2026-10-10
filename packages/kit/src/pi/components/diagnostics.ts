import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';

type Report = { event?: string; header?: string[]; lines?: string[]; issueUrl?: string; error?: string; ok?: boolean };

const REQUEST = 'kit-diag-request';
const OPEN = 'kit-diag-open';
const REPLY = 'kit-diag';
const COPY = 'kit-diag-copy';
const COPIED = 'kit-diag-copied';
const COPY_ICON = 'M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1Z';
const CROSS_ICON = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z';
const CHECK_ICON = 'M21 7 9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7Z';
const WARN = /\b(WARN|ERROR|FATAL)\b/;

/**
 * <pi-diagnostics> — a collapsed "Diagnostics" field in the settings window (diagnostics.ts on
 * the plugin side): the end of this plugin's log, with the lines that matter marked, a small icon
 * at the top right that copies the whole report (header with versions and the other plugins, then
 * the log, tokens and passwords already hidden), "Show log file" for the file manager and "Report
 * an issue" (copies the report and opens the plugin's issue page). Without an answer from the
 * plugin it says so instead.
 */
export class PiDiagnostics extends HTMLElement {
    private off?: () => void;
    private report: Report | undefined;
    private onlyWarnings = false;
    private waiting?: ReturnType<typeof setTimeout>;
    private copied?: (ok: boolean) => void;

    connectedCallback(): void {
        this.off = sd.onMessage((msg: Report) => {
            if (msg?.event === COPIED) {
                this.copied?.(msg.ok === true);
                return;
            }
            if (msg?.event !== REPLY) return;
            clearTimeout(this.waiting);
            this.report = msg;
            this.renderLog();
        });
        this.innerHTML = `<details class="pi-diag">
            <summary class="pi-diag-summary"><span>${escapeHtml(t('kit.diag_hint'))}</span>
                <button type="button" class="pi-icon-button pi-diag-copy" title="${escapeHtml(t('kit.diag_copy'))}" aria-label="${escapeHtml(t('kit.diag_copy'))}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${COPY_ICON}"/></svg></button>
            </summary>
            <div class="pi-diag-body">
                <label class="pi-diag-filter"><input type="checkbox" class="pi-diag-warn"/> <span>${escapeHtml(t('kit.diag_warnings'))}</span></label>
                <pre class="pi-diag-log" tabindex="0"></pre>
                <div class="pi-diag-actions">
                    <button type="button" class="pi-button pi-diag-open">${escapeHtml(t('kit.diag_open'))}</button>
                    <button type="button" class="pi-button pi-diag-issue" hidden>${escapeHtml(t('kit.diag_issue'))}</button>
                </div>
            </div>
        </details>`;
        const details = this.querySelector('details')!;
        details.addEventListener('toggle', () => {
            if (details.open) this.load();
        });
        // Opened from the footer's "Log" link
        if (location.hash === '#diagnostics') details.open = true;
        // The copy icon sits in the summary: don't let it toggle the field
        this.querySelector('.pi-diag-copy')!.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void this.copy(e.currentTarget as HTMLElement);
        });
        this.querySelector<HTMLInputElement>('.pi-diag-warn')!.addEventListener('change', (e) => {
            this.onlyWarnings = (e.target as HTMLInputElement).checked;
            this.renderLog();
        });
        this.querySelector('.pi-diag-open')!.addEventListener('click', () => sd.sendToPlugin({ event: OPEN }));
        this.querySelector('.pi-diag-issue')!.addEventListener('click', () => {
            // The page opens at once; the copy runs beside it (it can take a moment)
            if (this.report?.issueUrl) sd.openUrl(this.report.issueUrl);
            void this.copy();
        });
    }

    disconnectedCallback(): void {
        this.off?.();
        clearTimeout(this.waiting);
    }

    private load(): void {
        const log = this.querySelector('.pi-diag-log') as HTMLElement;
        log.textContent = t('kit.diag_loading');
        sd.sendToPlugin({ event: REQUEST });
        clearTimeout(this.waiting);
        this.waiting = setTimeout(() => {
            if (!this.report) log.textContent = t('kit.diag_unavailable');
        }, 3000);
    }

    private lines(): string[] {
        const all = this.report?.lines ?? [];
        return this.onlyWarnings ? all.filter((l) => WARN.test(l) || /^\s+at |^Error/.test(l)) : all;
    }

    private renderLog(): void {
        const log = this.querySelector('.pi-diag-log') as HTMLElement;
        if (this.report?.error) {
            log.textContent = `${t('kit.diag_unavailable')}\n${this.report.error}`;
        } else {
            const lines = this.lines();
            log.innerHTML = lines.length ? lines.map((l) => `<span class="${WARN.test(l) ? 'pi-diag-line-warn' : ''}">${escapeHtml(l)}</span>`).join('\n') : escapeHtml(t('kit.diag_empty'));
            log.scrollTop = log.scrollHeight;
        }
        const issue = this.querySelector<HTMLElement>('.pi-diag-issue')!;
        issue.hidden = !this.report?.issueUrl;
    }

    /** The whole report: the header, then the log (not only the filtered lines). */
    private text(): string {
        const r = this.report;
        return [...(r?.header ?? []), '', ...(r?.lines ?? [])].join('\n');
    }

    /**
     * The whole report on the clipboard. The plugin does it (the page's own clipboard API doesn't
     * answer in Stream Deck's browser); if it can't, the page tries its legacy copy. Never waits
     * for long: the icon shows a check, or a cross when nothing worked.
     */
    private async copy(button?: HTMLElement): Promise<void> {
        const ok = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => done(false), 2500);
            const done = (v: boolean) => {
                clearTimeout(timer);
                this.copied = undefined;
                resolve(v);
            };
            this.copied = done;
            sd.sendToPlugin({ event: COPY });
        });
        const copied = ok || this.legacyCopy(this.text());
        if (button) this.flash(button, copied);
    }

    /** execCommand("copy") from a selected textarea (works inside a click, without a permission). */
    private legacyCopy(text: string): boolean {
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            area.remove();
            return ok;
        } catch {
            return false;
        }
    }

    private flash(button: HTMLElement, ok: boolean): void {
        const path = button.querySelector('path');
        path?.setAttribute('d', ok ? CHECK_ICON : CROSS_ICON);
        button.title = t(ok ? 'kit.diag_copied' : 'kit.diag_copy_failed');
        setTimeout(() => {
            path?.setAttribute('d', COPY_ICON);
            button.title = t('kit.diag_copy');
        }, 1800);
    }
}
