import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { nextRequestId } from '../requests.js';
import { sd } from '../sd-client.js';

/** `image`: a picture URL (e.g. an app's icon as a data URI). */
type Item = { value: string; label: string; sub?: string; image?: string };

/**
 * <pi-multi-select setting="apps" source="apps" [label-setting="appNames"] [empty="pi.no_apps"]> —
 * several choices from the plugin's list (the same "options" request as <pi-select>), one switch
 * each; stored as an array of values. Chosen values the plugin doesn't list right now (an app that
 * is closed) stay, with their stored names from `label-setting` ({ value: name }).
 */
export class PiMultiSelect extends HTMLElement {
    private items: Item[] = [];
    private requestId = 0;
    private offs: (() => void)[] = [];

    private get key(): string {
        return this.getAttribute('setting') ?? '';
    }

    private get chosen(): string[] {
        const raw = sd.settings[this.key];
        return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
    }

    private get names(): Record<string, string> {
        const key = this.getAttribute('label-setting');
        const raw = key ? sd.settings[key] : undefined;
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string>) : {};
    }

    connectedCallback(): void {
        this.classList.add('pi-multi-select');
        this.offs.push(
            sd.onMessage((msg: { event?: string; requestId?: number; items?: Item[] }) => {
                if (msg?.event !== 'options-result' || msg.requestId !== this.requestId || !Array.isArray(msg.items)) return;
                this.items = msg.items;
                this.render();
            }),
            sd.onSettings(() => this.render()),
        );
        this.requestId = nextRequestId();
        sd.sendToPlugin({ event: 'options', requestId: this.requestId, source: this.getAttribute('source') ?? '', params: {} });
        this.render();
    }

    disconnectedCallback(): void {
        for (const off of this.offs) off();
        this.offs = [];
    }

    private render(): void {
        const chosen = this.chosen;
        const names = this.names;
        const rows: (Item & { away?: boolean })[] = [...this.items, ...chosen.filter((v) => !this.items.some((i) => i.value === v)).map((v) => ({ value: v, label: names[v] ?? v, away: true }))];
        if (!rows.length) {
            this.innerHTML = `<div class="pi-row"><span class="pi-hint">${escapeHtml(t(this.getAttribute('empty') ?? 'kit.multi_none'))}</span></div>`;
            return;
        }
        this.innerHTML = rows
            .map(
                (r) => `<div class="pi-row">
                    ${r.image ? `<img class="pi-multi-icon" src="${escapeHtml(r.image)}" alt=""/>` : ''}
                    <div class="pi-row-text">
                        <span class="pi-label">${escapeHtml(r.label)}</span>
                        ${r.away ? `<span class="pi-hint">${escapeHtml(t('kit.multi_away'))}</span>` : r.sub ? `<span class="pi-hint">${escapeHtml(r.sub)}</span>` : ''}
                    </div>
                    <button type="button" class="pi-switch" data-value="${escapeHtml(r.value)}" aria-pressed="${chosen.includes(r.value)}" aria-label="${escapeHtml(r.label)}"><span class="pi-switch-knob"></span></button>
                </div>`,
            )
            .join('');
        this.querySelectorAll<HTMLButtonElement>('button[data-value]').forEach((b) => b.addEventListener('click', () => this.toggle(b.dataset.value ?? '')));
    }

    private toggle(value: string): void {
        const chosen = this.chosen;
        const next = chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
        sd.setSetting(this.key, next);
        // Remember the names, so a closed app still shows as itself
        const nameKey = this.getAttribute('label-setting');
        if (nameKey) {
            const names = { ...this.names };
            const item = this.items.find((i) => i.value === value);
            if (item) names[value] = item.label;
            for (const k of Object.keys(names)) if (!next.includes(k)) delete names[k];
            sd.setSetting(nameKey, names);
        }
        this.render();
    }
}
