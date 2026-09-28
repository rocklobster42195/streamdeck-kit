// <pi-icon-picker setting="icon" [source="mdi-icons"] [default-icon="mdiBullhorn"] [none-label="…"]
//                 [reset-label="…"] [hint="…"]>
// Pick a Material Design Icon for a key: a search field with suggestions as icon tiles (the search
// runs in the plugin, see mdiOptions in "/mdi"), the current choice with its preview, and a button
// back to the key's default icon (or to none, for optional icons like a marker).
import type { KitPiPush, OptionItem } from '../../protocol.js';
import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { nextRequestId } from '../requests.js';
import { sd } from '../sd-client.js';

const svg = (path: string, size: number) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${escapeHtml(path)}"/></svg>`;

export class PiIconPicker extends HTMLElement {
    private requestId = 0;
    private results: OptionItem[] = [];
    private current: OptionItem | undefined;
    private query = '';
    private timer: ReturnType<typeof setTimeout> | undefined;
    private offs: (() => void)[] = [];

    private get key(): string {
        return this.getAttribute('setting') ?? 'icon';
    }

    private get value(): string {
        return String(sd.settings[this.key] ?? '');
    }

    connectedCallback(): void {
        this.classList.add('pi-icon-picker');
        const hint = this.getAttribute('hint');
        this.innerHTML = `
            <div class="pi-row">
                <span class="pi-icon-current"></span>
                <div class="pi-row-text"><span class="pi-label pi-icon-name"></span>${hint ? `<span class="pi-hint">${escapeHtml(t(hint))}</span>` : ''}</div>
                <button type="button" class="pi-button pi-icon-reset">${escapeHtml(t(this.getAttribute('reset-label') ?? 'kit.icon_default'))}</button>
            </div>
            <div class="pi-row"><input class="pi-input pi-icon-search" type="search" placeholder="${escapeHtml(t('kit.icon_search'))}"/></div>
            <div class="pi-icon-grid"></div>`;
        const input = this.querySelector<HTMLInputElement>('.pi-icon-search')!;
        input.addEventListener('input', () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.search(input.value.trim()), 250);
        });
        this.querySelector('.pi-icon-reset')!.addEventListener('click', () => sd.setSetting(this.key, undefined));
        this.offs.push(
            sd.onMessage((msg: KitPiPush) => {
                if (msg?.event !== 'options-result' || msg.requestId !== this.requestId) return;
                if (this.query) this.results = msg.items;
                else this.current = msg.items[0];
                this.render();
            }),
            sd.onSettings(() => this.lookupCurrent()),
        );
        this.lookupCurrent();
    }

    disconnectedCallback(): void {
        for (const off of this.offs) off();
        clearTimeout(this.timer);
    }

    /** The icon the key shows: the chosen one, else the key's default. */
    private get shown(): string {
        return this.value || (this.getAttribute('default-icon') ?? '');
    }

    /** Fetch the shown icon's path for its preview. */
    private lookupCurrent(): void {
        if (this.current?.value === this.shown) return this.render();
        this.current = undefined;
        this.query = '';
        if (!this.shown) return this.render();
        this.request(this.shown);
    }

    private search(query: string): void {
        this.query = query;
        if (!query) {
            this.results = [];
            return this.render();
        }
        this.request(query);
    }

    private request(q: string): void {
        this.requestId = nextRequestId();
        sd.sendToPlugin({ event: 'options', requestId: this.requestId, source: this.getAttribute('source') ?? 'mdi-icons', params: { q } });
    }

    private render(): void {
        const cur = this.current && this.current.value === this.shown ? this.current : undefined;
        this.querySelector('.pi-icon-current')!.innerHTML = cur?.icon ? svg(cur.icon, 28) : '';
        this.querySelector('.pi-icon-name')!.textContent = this.value && cur ? cur.label : t(this.getAttribute('none-label') ?? 'kit.icon_default_name');
        this.querySelector<HTMLButtonElement>('.pi-icon-reset')!.hidden = !this.value;
        const grid = this.querySelector<HTMLElement>('.pi-icon-grid')!;
        if (this.query && !this.results.length) {
            grid.innerHTML = `<div class="pi-hint">${escapeHtml(t('kit.icon_none_found'))}</div>`;
            return;
        }
        grid.innerHTML = this.results
            .map((r) => `<button type="button" class="pi-icon-tile" data-name="${escapeHtml(r.value)}" title="${escapeHtml(r.label)}" aria-pressed="${r.value === this.value}">${r.icon ? svg(r.icon, 24) : ''}</button>`)
            .join('');
        grid.querySelectorAll<HTMLButtonElement>('.pi-icon-tile').forEach((b) =>
            b.addEventListener('click', () => {
                this.current = this.results.find((r) => r.value === b.dataset.name);
                sd.setSetting(this.key, b.dataset.name);
            }),
        );
    }
}
