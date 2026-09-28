import { escapeHtml, icon } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

/** <pi-field setting="maUrl" [global] [type="password"] label="…" placeholder="…" hint="…"> — a text field that saves on change. */
export class PiField extends HTMLElement {
    private unsubscribe?: () => void;
    connectedCallback(): void {
        const setting = bound(this);
        const isPassword = this.getAttribute('type') === 'password';
        const label = this.getAttribute('label');
        const hint = this.getAttribute('hint');
        const placeholder = this.getAttribute('placeholder');
        this.classList.add('pi-field');
        this.innerHTML = `
            <label>
                ${label ? `<span class="pi-field-label">${escapeHtml(t(label))}</span>` : ''}
                <span class="pi-input-row">
                    <input class="pi-input" type="${isPassword ? 'password' : 'text'}" spellcheck="false" autocomplete="off"
                        ${placeholder ? `placeholder="${escapeHtml(t(placeholder))}"` : ''}/>
                    ${isPassword ? `<button type="button" class="pi-icon-button" aria-label="${escapeHtml(t('pi.show_token'))}">${icon('eye')}</button>` : ''}
                </span>
                ${hint ? `<span class="pi-hint">${escapeHtml(t(hint))}</span>` : ''}
            </label>`;
        const input = this.querySelector('input')!;
        const render = () => {
            if (document.activeElement !== input) input.value = String(setting.get() ?? '');
        };
        const commit = () => {
            const value = input.value.trim();
            if (value !== String(setting.get() ?? '')) setting.set(value);
        };
        input.addEventListener('change', commit);
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
        this.querySelector('.pi-icon-button')?.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
        });
        this.unsubscribe = setting.subscribe(render);
        render();
    }
    disconnectedCallback(): void {
        this.unsubscribe?.();
    }
    /** Mark the field as invalid (red border) with an optional message. */
    setError(message: string | null): void {
        this.classList.toggle('pi-invalid', !!message);
        let el = this.querySelector<HTMLElement>('.pi-error');
        if (!message) return el?.remove();
        if (!el) {
            el = document.createElement('span');
            el.className = 'pi-hint pi-error';
            this.querySelector('label')!.append(el);
        }
        el.textContent = message;
    }
}
