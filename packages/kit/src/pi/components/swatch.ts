// <pi-swatch value="#F7A600" [auto]> — a colour swatch that opens the kit's colour picker. It stands
// in for <input type="color">: same `value`, same "input" (while dragging) and "change" (picked)
// events, so code written for the native field keeps working. With `auto`, "automatic" can be
// picked too (value "auto", drawn striped).
import { normalizeHex } from '../color-math.js';
import { t } from '../i18n.js';
import { openColorPopover } from './color-popover.js';

export class PiSwatch extends HTMLElement {
    private current = '#FFFFFF';
    private built = false;

    static get observedAttributes(): string[] {
        return ['value'];
    }

    get value(): string {
        return this.current;
    }

    set value(v: string) {
        this.current = v === 'auto' ? 'auto' : (normalizeHex(v) ?? this.current);
        this.paint();
    }

    attributeChangedCallback(_name: string, _old: string | null, v: string | null): void {
        if (v !== null) this.value = v;
    }

    connectedCallback(): void {
        // A value set before this element was defined sits on the instance and would hide the setter
        if (Object.prototype.hasOwnProperty.call(this, 'value')) {
            const early = (this as unknown as { value: string }).value;
            delete (this as unknown as { value?: string }).value;
            this.value = early;
        }
        // Sections move their children once (detach, attach): wire everything only the first time
        if (this.built) return;
        this.built = true;
        this.classList.add('pi-swatch');
        this.setAttribute('role', 'button');
        this.tabIndex = 0;
        this.setAttribute('aria-label', t('kit.color_pick'));
        const v = this.getAttribute('value');
        if (v) this.value = v;
        this.addEventListener('click', () => this.open());
        this.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), this.open()));
        this.paint();
    }

    private open(): void {
        openColorPopover(this, {
            value: this.current,
            auto: this.hasAttribute('auto'),
            onInput: (v) => {
                this.value = v;
                this.dispatchEvent(new Event('input', { bubbles: true }));
            },
            onChange: (v) => {
                this.value = v;
                this.dispatchEvent(new Event('input', { bubbles: true }));
                this.dispatchEvent(new Event('change', { bubbles: true }));
            },
        });
    }

    private paint(): void {
        const auto = this.current === 'auto';
        this.classList.toggle('pi-swatch-auto', auto);
        this.style.setProperty('--pi-swatch', auto ? 'transparent' : this.current);
        this.title = auto ? t('kit.color_auto') : this.current;
    }
}
