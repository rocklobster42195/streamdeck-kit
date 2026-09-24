import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

/** <pi-color setting="primaryColor" default="#87AE73" label="…"> — color swatch picker with the hex value next to it. */
export class PiColor extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        const setting = bound(this);
        const def = this.getAttribute('default') ?? '#ffffff';
        const label = t(this.getAttribute('label') ?? '');
        this.classList.add('pi-row');
        this.innerHTML = `
            <div class="pi-row-text"><span class="pi-label">${escapeHtml(label)}</span><span class="pi-hint pi-color-hex"></span></div>
            <input class="pi-color" type="color" aria-label="${escapeHtml(label)}"/>`;
        const input = this.querySelector('input')!;
        const hex = this.querySelector<HTMLElement>('.pi-color-hex')!;
        const render = () => {
            const v = String(setting.get() ?? def);
            if (document.activeElement !== input) input.value = v;
            hex.textContent = v.toUpperCase();
        };
        input.addEventListener('input', () => (hex.textContent = input.value.toUpperCase()));
        input.addEventListener('change', () => setting.set(input.value));
        this.unsubscribe = setting.subscribe(render);
        render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }
}
