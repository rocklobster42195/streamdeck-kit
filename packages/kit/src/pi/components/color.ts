import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

/**
 * <pi-color setting="primaryColor" default="#87AE73" label="…" [auto]> — a colour setting: label,
 * the hex value, and a swatch that opens the kit's colour picker (standard colours, recent colours,
 * colour wheel, hex and RGB). With `auto`, "automatic" can be picked (stored as "auto").
 */
export class PiColor extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        const setting = bound(this);
        const def = this.getAttribute('default') ?? '#ffffff';
        const label = t(this.getAttribute('label') ?? '');
        this.classList.add('pi-row');
        this.innerHTML = `
            <div class="pi-row-text"><span class="pi-label">${escapeHtml(label)}</span><span class="pi-hint pi-color-hex"></span></div>
            <pi-swatch class="pi-color"${this.hasAttribute('auto') ? ' auto' : ''}></pi-swatch>`;
        const swatch = this.querySelector('pi-swatch') as HTMLElement & { value: string };
        const hex = this.querySelector<HTMLElement>('.pi-color-hex')!;
        const shown = (v: string) => (v === 'auto' ? t('kit.color_auto') : v.toUpperCase());
        const render = () => {
            const v = String(setting.get() ?? def);
            swatch.value = v;
            hex.textContent = shown(v);
        };
        // Preview the hex while dragging, save once picked
        swatch.addEventListener('input', () => (hex.textContent = shown(swatch.value)));
        swatch.addEventListener('change', () => setting.set(swatch.value));
        this.unsubscribe = setting.subscribe(render);
        render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }
}
