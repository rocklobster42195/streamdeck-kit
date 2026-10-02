// <pi-more [ready-when="entityId,topic"] [label="…"] [setup-label="…"] [setup-hint="…"]>: the short
// PI's way into the settings window (see window.ts). "More settings …"; while none of the
// `ready-when` settings is filled in, "Set up …" in blue with a line saying why. When the window
// can't open, the PI shows everything inline. Only in the PI (hidden in the window and inline).
import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';
import { openSettingsWindow, showSettingsInline } from '../window.js';

const filled = (v: unknown): boolean => (typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null);

export class PiMore extends HTMLElement {
    private off: (() => void) | undefined;

    connectedCallback(): void {
        this.classList.add('pi-pi-only');
        const hint = this.getAttribute('setup-hint') ?? 'kit.set_up_hint';
        this.innerHTML = `<button type="button" class="pi-button pi-more-button"></button><span class="pi-hint pi-more-hint" hidden>${escapeHtml(t(hint))}</span>`;
        this.querySelector('button')!.addEventListener('click', () => {
            if (!openSettingsWindow()) showSettingsInline();
        });
        this.off = sd.onSettings(() => this.render());
        this.render();
    }

    disconnectedCallback(): void {
        this.off?.();
    }

    private render(): void {
        const s = sd.settings as Record<string, unknown>;
        const keys = (this.getAttribute('ready-when') ?? '').split(',').map((k) => k.trim()).filter(Boolean);
        const ready = !keys.length || keys.some((k) => filled(s[k]));
        const button = this.querySelector('button')!;
        button.textContent = t(ready ? (this.getAttribute('label') ?? 'kit.more_settings') : (this.getAttribute('setup-label') ?? 'kit.set_up'));
        button.classList.toggle('pi-button-primary', !ready);
        // Why the button is blue: not set up yet
        this.querySelector<HTMLElement>('.pi-more-hint')!.hidden = ready;
    }
}
