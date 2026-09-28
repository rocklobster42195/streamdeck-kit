import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

/** <pi-toggle setting="showProgress" label="pi.show_progress" hint="pi.show_progress_hint" [global] [data-default="true"]> — a switch bound to a setting. */
export class PiToggle extends HTMLElement {
    private unsubscribe?: () => void;
    connectedCallback(): void {
        const setting = bound(this);
        const label = t(this.getAttribute('label') ?? '');
        const hint = this.getAttribute('hint');
        this.classList.add('pi-row');
        this.innerHTML = `
            <div class="pi-row-text">
                <span class="pi-label">${escapeHtml(label)}</span>
                ${hint ? `<span class="pi-hint">${escapeHtml(t(hint))}</span>` : ''}
            </div>
            <button type="button" class="pi-switch" aria-label="${escapeHtml(label)}"><span class="pi-switch-knob"></span></button>`;
        const button = this.querySelector('button')!;
        // data-default="true": an unset setting counts as on
        const isOn = () => {
            const v = setting.get();
            return v === undefined ? this.dataset.default === 'true' : v === true;
        };
        const render = () => button.setAttribute('aria-pressed', String(isOn()));
        button.addEventListener('click', () => {
            setting.set(!isOn());
            render();
        });
        this.unsubscribe = setting.subscribe(render);
        render();
    }
    disconnectedCallback(): void {
        this.unsubscribe?.();
    }
}
