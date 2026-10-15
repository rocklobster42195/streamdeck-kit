import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';

const SPEEDS = ['fast', 'normal', 'slow'] as const;

/**
 * <pi-multi-tap [setting="multiTap"] [speed-setting="tapSpeed"]> — the Play/Pause key's double and
 * triple tap (grill 2026-10-15): a switch (off by default: a single tap then waits a moment) and,
 * while it is on, how quickly the taps have to follow each other (fast / normal / slow).
 */
export class PiMultiTap extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        this.classList.add('pi-multi-tap');
        this.unsubscribe = sd.onSettings(() => this.render());
        this.render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }

    private render(): void {
        const key = this.getAttribute('setting') ?? 'multiTap';
        const speedKey = this.getAttribute('speed-setting') ?? 'tapSpeed';
        const on = sd.settings[key] === true;
        const speed = String(sd.settings[speedKey] ?? 'normal');
        const label = t('kit.multi_tap');
        const tiles = SPEEDS.map((s) => `<button type="button" class="pi-choice-tile" data-speed="${s}" aria-pressed="${s === speed}"><span>${escapeHtml(t(`kit.tap_speed_${s}`))}</span></button>`);
        this.innerHTML = `
            <div class="pi-row">
                <div class="pi-row-text">
                    <span class="pi-label">${escapeHtml(label)}</span>
                    <span class="pi-hint">${escapeHtml(t('kit.multi_tap_hint'))}</span>
                </div>
                <button type="button" class="pi-switch" aria-label="${escapeHtml(label)}" aria-pressed="${on}"><span class="pi-switch-knob"></span></button>
            </div>
            ${on ? `<span class="pi-label">${escapeHtml(t('kit.tap_speed'))}</span><div class="pi-choice" style="--pi-choice-columns: 3">${tiles.join('')}</div>` : ''}`;
        this.querySelector('.pi-switch')?.addEventListener('click', () => sd.setSetting(key, !on));
        this.querySelectorAll<HTMLElement>('[data-speed]').forEach((el) => el.addEventListener('click', () => sd.setSetting(speedKey, el.dataset.speed)));
    }
}
