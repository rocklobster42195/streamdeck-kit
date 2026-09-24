import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

/** <pi-range setting="preset" min="0" max="100" step="1" default="20" label="…" unit="%"> — slider with live value. */
export class PiRange extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        const setting = bound(this);
        const min = Number(this.getAttribute('min') ?? 0);
        const max = Number(this.getAttribute('max') ?? 100);
        const step = Number(this.getAttribute('step') ?? 1);
        const def = Number(this.getAttribute('default') ?? min);
        const unit = this.getAttribute('unit') ?? '';
        const label = this.getAttribute('label');
        this.classList.add('pi-row');
        this.innerHTML = `
            <div class="pi-row-text">
                <span class="pi-label">${escapeHtml(t(label ?? ''))}</span>
                <input class="pi-range" type="range" min="${min}" max="${max}" step="${step}" aria-label="${escapeHtml(t(label ?? ''))}"/>
            </div>
            <span class="pi-range-value"></span>`;
        const input = this.querySelector('input')!;
        const out = this.querySelector<HTMLElement>('.pi-range-value')!;
        const render = () => {
            const v = Number(setting.get() ?? def);
            if (document.activeElement !== input) input.value = String(v);
            out.textContent = `${input.value}${unit}`;
        };
        input.addEventListener('input', () => (out.textContent = `${input.value}${unit}`));
        input.addEventListener('change', () => setting.set(Number(input.value)));
        this.unsubscribe = setting.subscribe(render);
        render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }
}
