import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

export type PiChoiceOption = { value: string; label: string; icon?: string };

/**
 * <pi-choice setting="command" columns="3"> with options set via the `options` property
 * ([{ value, label (i18n key), icon? (24×24 SVG path) }]) — a grid of tiles, one selected.
 */
export class PiChoice extends HTMLElement {
    private _options: PiChoiceOption[] = [];
    private unsubscribe?: () => void;

    set options(options: PiChoiceOption[]) {
        this._options = options;
        if (this.isConnected) this.render();
    }

    connectedCallback(): void {
        this.classList.add('pi-choice');
        this.style.setProperty('--pi-choice-columns', this.getAttribute('columns') ?? '3');
        this.unsubscribe = bound(this).subscribe(() => this.render());
        this.render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }

    private render(): void {
        const setting = bound(this);
        const value = String(setting.get() ?? this.getAttribute('default') ?? '');
        this.innerHTML = this._options
            .map(
                (o) => `<button type="button" class="pi-choice-tile" data-value="${escapeHtml(o.value)}" aria-pressed="${o.value === value}">
                    ${o.icon ? `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${escapeHtml(o.icon)}"/></svg>` : ''}
                    <span>${escapeHtml(t(o.label))}</span></button>`,
            )
            .join('');
        this.querySelectorAll<HTMLElement>('.pi-choice-tile').forEach((el) =>
            el.addEventListener('click', () => {
                setting.set(el.dataset.value);
                this.render();
            }),
        );
    }
}

/**
 * Read every `<pi-choice data-options='[{"value":"left","label":"pi.left","icon":"alignLeft"}]'>`
 * and hand the parsed options to the element; icon names are looked up in `icons` (name → MDI
 * path, from the plugin, so only the icons it uses are bundled).
 */
export function initChoiceOptions(icons: Record<string, string> = {}): void {
    document.querySelectorAll<PiChoice>('pi-choice[data-options]').forEach((el) => {
        const raw = JSON.parse(el.dataset.options ?? '[]') as PiChoiceOption[];
        el.options = raw.map((o) => ({ ...o, icon: o.icon ? icons[o.icon] ?? o.icon : undefined }));
    });
}
