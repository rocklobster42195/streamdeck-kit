import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { nextRequestId } from '../requests.js';
import { sd } from '../sd-client.js';

type StateRow = { value: string; label?: string; icon?: string; color?: string };
type Item = { value: string; label: string; icon?: string };
type OptionsResult = { event?: string; requestId?: number; items?: Item[] };

/** House palette colours for new rows, in turn. */
const COLORS = ['#F7A600', '#59A028', '#009FDF', '#E30018', '#E14190', '#00ACA8'];
const svg = (path: string | undefined, size = 22) => (path ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${escapeHtml(path)}"/></svg>` : '');

type CurrentValue = (settings: Record<string, unknown>, report: (value: string | undefined) => void) => void;
let currentValue: CurrentValue | undefined;

/**
 * Lets the plugin's PI offer "Add “<value>”" for the value the device reports right now (HA-C: an
 * entity's state or an MQTT payload): `fn` is asked whenever the settings change and calls `report`
 * when it knows.
 */
export function registerStatesCurrent(fn: CurrentValue): void {
    currentValue = fn;
}

/**
 * <pi-states setting="states" [value-source="output-devices"]> — the Multi-state key's list
 * (multi-state/index.ts): one row per state with its value, a name, a colour and an icon (searched
 * through the plugin's "mdi-icons" list). Values are typed, or with `value-source` picked from the
 * plugin's list (e.g. audio devices; the name then defaults to the item's). Rows can be added, moved
 * up and removed. Stored as [{ value, label?, icon?, color? }].
 */
export class PiStates extends HTMLElement {
    /** Icon name → path ("" when unknown), from the plugin's icon list. */
    private readonly paths = new Map<string, string>();
    private readonly pending = new Map<number, string>();
    private picking = -1;
    private searchId = 0;
    private results: Item[] = [];
    private choices: Item[] = [];
    private choicesId = 0;
    private current: string | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private offs: (() => void)[] = [];

    private get key(): string {
        return this.getAttribute('setting') ?? 'states';
    }

    private get rows(): StateRow[] {
        const raw = sd.settings[this.key];
        return Array.isArray(raw) ? (raw as StateRow[]).map((r) => ({ ...r })) : [];
    }

    connectedCallback(): void {
        this.classList.add('pi-states');
        this.offs.push(
            sd.onMessage((msg: OptionsResult) => {
                if (msg?.event !== 'options-result' || !Array.isArray(msg.items)) return;
                if (msg.requestId === this.searchId) {
                    this.results = msg.items;
                    this.renderResults();
                } else if (msg.requestId === this.choicesId) {
                    this.choices = msg.items;
                    this.render();
                } else if (msg.requestId !== undefined && this.pending.has(msg.requestId)) {
                    const name = this.pending.get(msg.requestId)!;
                    this.pending.delete(msg.requestId);
                    // Unknown names are remembered too, so they aren't asked for again
                    this.paths.set(name, msg.items[0]?.icon ?? '');
                    this.render();
                }
            }),
            sd.onSettings(() => {
                this.askCurrent();
                this.render();
            }),
        );
        this.askChoices();
        this.askCurrent();
        this.render();
    }

    disconnectedCallback(): void {
        for (const off of this.offs) off();
        this.offs = [];
    }

    private save(rows: StateRow[]): void {
        sd.setSetting(this.key, rows);
    }

    private askChoices(): void {
        const source = this.getAttribute('value-source');
        if (!source) return;
        this.choicesId = nextRequestId();
        sd.sendToPlugin({ event: 'options', requestId: this.choicesId, source, params: {} });
    }

    private askCurrent(): void {
        currentValue?.(sd.settings, (value) => {
            this.current = value;
            this.render();
        });
    }

    /** Ask the plugin for the paths of icons we don't know yet. */
    private lookupIcons(rows: StateRow[]): void {
        for (const name of new Set(rows.map((r) => r.icon).filter((n): n is string => !!n))) {
            if (this.paths.has(name) || [...this.pending.values()].includes(name)) continue;
            const id = nextRequestId();
            this.pending.set(id, name);
            sd.sendToPlugin({ event: 'options', requestId: id, source: 'mdi-icons', params: { q: name } });
        }
    }

    private valueField(r: StateRow): string {
        if (!this.getAttribute('value-source')) return `<input class="pi-input pi-state-value" type="text" spellcheck="false" placeholder="${escapeHtml(t('kit.state_value'))}" value="${escapeHtml(r.value ?? '')}"/>`;
        const known = this.choices.some((c) => c.value === r.value);
        const options = [
            `<option value="" ${r.value ? '' : 'selected'} disabled>${escapeHtml(t('kit.state_choose'))}</option>`,
            ...this.choices.map((c) => `<option value="${escapeHtml(c.value)}" ${c.value === r.value ? 'selected' : ''}>${escapeHtml(c.label)}</option>`),
            // A stored value the plugin doesn't list now (a device unplugged): kept, shown as it is
            ...(r.value && !known ? [`<option value="${escapeHtml(r.value)}" selected>${escapeHtml(r.label || r.value)}</option>`] : []),
        ];
        return `<select class="pi-input pi-state-value pi-state-pick">${options.join('')}</select>`;
    }

    private render(): void {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement && this.contains(active) && active.type === 'text') return;
        const rows = this.rows;
        this.lookupIcons(rows);
        const cur = this.current?.trim();
        const hasCurrent = !!cur && cur.length <= 40 && !rows.some((r) => r.value.trim().toLowerCase() === cur.toLowerCase());
        this.innerHTML = `
            ${rows
                .map(
                    (r, i) => `
                <div class="pi-state-row" data-i="${i}">
                    <button type="button" class="pi-icon-button pi-state-icon" title="${escapeHtml(t('kit.state_icon'))}" style="color:${escapeHtml(r.color || COLORS[0])}">${svg(r.icon ? this.paths.get(r.icon) || undefined : undefined) || '+'}</button>
                    ${this.valueField(r)}
                    <input class="pi-input pi-state-label" type="text" placeholder="${escapeHtml(t('kit.state_label'))}" value="${escapeHtml(r.label ?? '')}"/>
                    <pi-swatch class="pi-color" value="${escapeHtml(r.color || COLORS[0])}"></pi-swatch>
                    <button type="button" class="pi-icon-button pi-state-up" title="${escapeHtml(t('kit.state_up'))}" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" class="pi-icon-button pi-state-remove" title="${escapeHtml(t('kit.threshold_remove'))}">×</button>
                </div>
                ${this.picking === i ? `<div class="pi-state-picker"><input class="pi-input pi-state-search" type="search" placeholder="${escapeHtml(t('kit.icon_search'))}"/><div class="pi-icon-grid pi-state-results"></div></div>` : ''}`,
                )
                .join('')}
            <div class="pi-state-actions">
                <button type="button" class="pi-button pi-button-small pi-state-add">${escapeHtml(t('kit.state_add'))}</button>
                ${hasCurrent ? `<button type="button" class="pi-button pi-button-small pi-state-add-current">${escapeHtml(t('kit.state_add_current', { value: cur! }))}</button>` : ''}
            </div>`;

        const rowOf = (el: Element) => Number((el.closest('.pi-state-row') as HTMLElement).dataset.i);
        const edit = (el: Element, patch: Partial<StateRow>) => {
            const next = this.rows;
            Object.assign(next[rowOf(el)], patch);
            this.save(next);
        };
        this.querySelectorAll<HTMLInputElement>('input.pi-state-value').forEach((el) => el.addEventListener('change', () => edit(el, { value: el.value.trim() })));
        this.querySelectorAll<HTMLSelectElement>('select.pi-state-pick').forEach((el) =>
            el.addEventListener('change', () => {
                const row = this.rows[rowOf(el)];
                const item = this.choices.find((c) => c.value === el.value);
                // The item's name unless the user named the state already
                edit(el, { value: el.value, ...(!row?.label && item ? { label: item.label } : {}) });
            }),
        );
        this.querySelectorAll<HTMLInputElement>('.pi-state-label').forEach((el) => el.addEventListener('change', () => edit(el, { label: el.value.trim() || undefined })));
        this.querySelectorAll<HTMLInputElement>('.pi-state-row .pi-color').forEach((el) => el.addEventListener('change', () => edit(el, { color: el.value })));
        this.querySelectorAll<HTMLElement>('.pi-state-remove').forEach((el) =>
            el.addEventListener('click', () => {
                this.picking = -1;
                this.save(this.rows.filter((_, i) => i !== rowOf(el)));
            }),
        );
        this.querySelectorAll<HTMLElement>('.pi-state-up').forEach((el) =>
            el.addEventListener('click', () => {
                const i = rowOf(el);
                const next = this.rows;
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                this.picking = -1;
                this.save(next);
            }),
        );
        this.querySelectorAll<HTMLElement>('.pi-state-icon').forEach((el) =>
            el.addEventListener('click', () => {
                const i = rowOf(el);
                this.picking = this.picking === i ? -1 : i;
                this.results = [];
                this.render();
                this.querySelector<HTMLInputElement>('.pi-state-search')?.focus();
            }),
        );
        const search = this.querySelector<HTMLInputElement>('.pi-state-search');
        search?.addEventListener('input', () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.searchId = nextRequestId();
                sd.sendToPlugin({ event: 'options', requestId: this.searchId, source: 'mdi-icons', params: { q: search.value.trim() } });
            }, 250);
        });
        this.querySelector('.pi-state-add')!.addEventListener('click', () => this.save([...this.rows, { value: '', color: COLORS[this.rows.length % COLORS.length] }]));
        this.querySelector('.pi-state-add-current')?.addEventListener('click', () => this.save([...this.rows, { value: cur!, color: COLORS[this.rows.length % COLORS.length] }]));
    }

    private renderResults(): void {
        const grid = this.querySelector<HTMLElement>('.pi-state-results');
        if (!grid) return;
        grid.innerHTML = this.results.map((r, n) => `<button type="button" class="pi-icon-tile" data-n="${n}" title="${escapeHtml(r.label)}">${svg(r.icon)}</button>`).join('');
        grid.querySelectorAll<HTMLElement>('.pi-icon-tile').forEach((el) =>
            el.addEventListener('click', () => {
                const r = this.results[Number(el.dataset.n)];
                if (r.icon) this.paths.set(r.value, r.icon);
                const next = this.rows;
                next[this.picking].icon = r.value;
                this.picking = -1;
                this.save(next);
            }),
        );
    }
}
