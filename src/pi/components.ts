// Generic, device-agnostic PI components. Light DOM custom elements bound to Stream Deck settings.
//
//   <pi-section title="pi.display">…children…</pi-section>
//   <pi-toggle setting="showProgress" label="pi.show_progress" hint="pi.show_progress_hint"></pi-toggle>
//   <pi-field setting="maUrl" global label="pi.server_url" placeholder="pi.server_url_placeholder" hint="…"></pi-field>
//   <pi-field setting="maToken" global type="password" label="pi.token"></pi-field>
//
// Attribute values for label/hint/placeholder/title are i18n keys (literal text works as fallback).
import { escapeHtml, icon } from './dom.js';
import { t } from './i18n.js';
import { sd } from './sd-client.js';

/** Read/write a setting, action-level or global depending on the element's `global` attribute. */
function bound(el: HTMLElement) {
    const key = el.getAttribute('setting') ?? '';
    const global = el.hasAttribute('global');
    return {
        get: (): unknown => (global ? sd.globalSettings : sd.settings)[key],
        set: (value: unknown) => (global ? sd.setGlobalSetting(key, value) : sd.setSetting(key, value)),
        subscribe: (fn: () => void) => (global ? sd.onGlobalSettings(fn) : sd.onSettings(fn)),
    };
}

export class PiSection extends HTMLElement {
    private built = false;
    connectedCallback(): void {
        if (this.built) return;
        this.built = true;
        const body = document.createElement('div');
        body.className = 'pi-card';
        body.append(...Array.from(this.childNodes));
        const title = this.getAttribute('title');
        this.removeAttribute('title'); // avoid the native tooltip
        if (title) {
            const h = document.createElement('div');
            h.className = 'pi-section-title';
            h.textContent = t(title);
            this.append(h);
        }
        this.append(body);
    }
}

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
        const render = () => button.setAttribute('aria-pressed', String(setting.get() === true));
        button.addEventListener('click', () => {
            setting.set(!(setting.get() === true));
            render();
        });
        this.unsubscribe = setting.subscribe(render);
        render();
    }
    disconnectedCallback(): void {
        this.unsubscribe?.();
    }
}

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

export function definePiComponents(): void {
    if (!customElements.get('pi-section')) customElements.define('pi-section', PiSection);
    if (!customElements.get('pi-toggle')) customElements.define('pi-toggle', PiToggle);
    if (!customElements.get('pi-field')) customElements.define('pi-field', PiField);
}
