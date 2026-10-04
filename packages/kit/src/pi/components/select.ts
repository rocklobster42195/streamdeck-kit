// <pi-select setting="source" source="player-sources" [label-setting="sourceName"] [with="player"]
//            [placeholder="…"] [empty="…"] [global]>
// A dropdown whose options come from the plugin (see PiBridge.registerOptions). `with` names
// parameter sets the plugin registered with registerSelectParams (e.g. the action's player); the
// list reloads when they change. `label-setting` also stores the chosen label (e.g. to show it on
// the key).
import type { KitPiPush, OptionItem } from '../../protocol.js';
import { escapeHtml, icon } from '../dom.js';
import { t } from '../i18n.js';
import { nextRequestId } from '../requests.js';
import { sd } from '../sd-client.js';

type ParamsFn = () => Record<string, string>;

/** A label from the plugin; "kit.…" keys are the kit's own texts (e.g. "kit.player_active"). */
const shown = (label: string) => (label.startsWith('kit.') ? t(label) : label);

const paramSets = new Map<string, ParamsFn>();
const live = new Set<PiSelect>();

/** Parameters a <pi-select with="name"> sends along with its request (e.g. { playerId }). */
export function registerSelectParams(name: string, params: ParamsFn): void {
    paramSets.set(name, params);
}

/** Re-check every select's parameters (e.g. after the plugin pushed new state); reloads only those that changed. */
export function refreshPiSelects(): void {
    for (const el of live) el.refresh();
}

/** Ask the plugin again for every select's list (e.g. once the plugin's connection is up). */
export function reloadPiSelects(): void {
    for (const el of live) el.refresh(true);
}

export class PiSelect extends HTMLElement {
    private open = false;
    private items: OptionItem[] | undefined;
    private error: string | undefined;
    private requestId = 0;
    private paramsKey: string | undefined;
    private offs: (() => void)[] = [];
    private readonly onDocClick = (e: MouseEvent) => {
        // composedPath is fixed at dispatch: opening re-renders the button, so e.target may already be
        // detached and contains() would wrongly report an outside click (the list closed again at once)
        if (this.open && !e.composedPath().includes(this)) this.setOpen(false);
    };

    private get key(): string {
        return this.getAttribute('setting') ?? '';
    }
    private get store() {
        return this.hasAttribute('global') ? sd.globalSettings : sd.settings;
    }

    connectedCallback(): void {
        this.classList.add('pi-select');
        this.innerHTML = `<button type="button" class="pi-select-button" aria-haspopup="listbox" aria-expanded="false"></button><div class="pi-select-list" role="listbox" hidden></div>`;
        this.querySelector('.pi-select-button')!.addEventListener('click', () => this.setOpen(!this.open));
        this.addEventListener('keydown', (e) => e.key === 'Escape' && this.setOpen(false));
        document.addEventListener('click', this.onDocClick);
        this.offs.push(
            sd.onMessage((msg: KitPiPush) => {
                if (msg?.event !== 'options-result' || msg.requestId !== this.requestId) return;
                this.items = msg.items;
                this.error = msg.error;
                this.render();
            }),
            sd.onSettings(() => this.refresh()),
            sd.onGlobalSettings(() => this.refresh()),
        );
        live.add(this);
        this.refresh();
    }

    disconnectedCallback(): void {
        for (const off of this.offs) off();
        document.removeEventListener('click', this.onDocClick);
        live.delete(this);
    }

    /** (Re)load the options when the request parameters changed (or `force`); re-render otherwise. */
    refresh(force = false): void {
        const params: Record<string, string> = {};
        const sets = (this.getAttribute('with') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        for (const name of sets) Object.assign(params, paramSets.get(name)?.());
        const key = JSON.stringify(params);
        if (force || key !== this.paramsKey) {
            this.paramsKey = key;
            this.requestId = nextRequestId();
            this.items = undefined;
            sd.sendToPlugin({ event: 'options', requestId: this.requestId, source: this.getAttribute('source') ?? '', params });
        }
        this.render();
    }

    private setOpen(open: boolean): void {
        this.open = open;
        this.render();
    }

    private choose(item: OptionItem): void {
        const labelKey = this.getAttribute('label-setting');
        const patch: Record<string, string> = { [this.key]: item.value, ...(labelKey ? { [labelKey]: shown(item.label) } : {}) };
        if (this.hasAttribute('global')) for (const [k, v] of Object.entries(patch)) sd.setGlobalSetting(k, v);
        else sd.setSettings(patch);
        this.setOpen(false);
    }

    private render(): void {
        const value = String(this.store[this.key] ?? '');
        const current = this.items?.find((i) => i.value === value);
        const labelKey = this.getAttribute('label-setting');
        const stored = labelKey ? (this.store[labelKey] as string | undefined) : undefined;
        const label = (current && shown(current.label)) ?? stored ?? (value || t(this.getAttribute('placeholder') ?? 'kit.choose'));
        const button = this.querySelector<HTMLElement>('.pi-select-button')!;
        button.setAttribute('aria-expanded', String(this.open));
        const sub = current?.sub ? `<span class="pi-option-sub">${escapeHtml(current.sub)}</span>` : '';
        button.innerHTML = `${picture(current?.image)}<span class="pi-select-text"><span class="pi-strong">${escapeHtml(label)}</span>${sub}</span>${icon('chevronDown', 16)}`;

        const list = this.querySelector<HTMLElement>('.pi-select-list')!;
        list.hidden = !this.open;
        if (!this.open) return;
        if (!this.items) {
            list.innerHTML = `<div class="pi-hint pi-select-note">${escapeHtml(t('kit.loading'))}</div>`;
            return;
        }
        if (!this.items.length) {
            list.innerHTML = `<div class="pi-hint pi-select-note">${escapeHtml(this.error ?? t(this.getAttribute('empty') ?? 'kit.no_options'))}</div>`;
            return;
        }
        list.innerHTML = this.items
            .map((i, n) => {
                const itemSub = i.sub ? `<span class="pi-option-sub">${escapeHtml(i.sub)}</span>` : '';
                const check = i.value === value ? icon('check', 14) : '';
                return `<button type="button" class="pi-option" role="option" data-n="${n}" aria-selected="${i.value === value}">${picture(i.image)}<span class="pi-select-text"><span class="pi-label">${escapeHtml(shown(i.label))}</span>${itemSub}</span><span class="pi-option-check">${check}</span></button>`;
            })
            .join('');
        list.querySelectorAll<HTMLElement>('.pi-option').forEach((el) => el.addEventListener('click', () => this.choose(this.items![Number(el.dataset.n)])));
    }
}

/** An option's picture (only data URIs and http(s) URLs). */
function picture(src: string | undefined): string {
    return src && /^(data:image\/|https?:)/.test(src) ? `<img class="pi-option-image" src="${escapeHtml(src)}" alt="">` : '';
}
