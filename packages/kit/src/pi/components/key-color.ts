import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { bound } from './bound.js';

const MODES = ['grey', 'cover', 'row', 'fixed'] as const;
type Mode = (typeof MODES)[number];

const modeOf = (v: string): Mode => (/^#[0-9a-f]{6}$/i.test(v) ? 'fixed' : (MODES as readonly string[]).includes(v) ? (v as Mode) : 'grey');

/**
 * <pi-key-color setting="keyColor" [label="…" | label=""] [fixed-default="#87AE73"]> — a key's colour (grill
 * 2026-10-04): Grey (today's look, the default), Cover (the key's player), Like the Panorama (the
 * row colour of the key's Stream Deck) or a fixed colour from the colour picker. Stored as "grey",
 * "cover", "row" or "#RRGGBB" (see resolveKeyColor).
 */
export class PiKeyColor extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        this.classList.add('pi-key-color');
        this.unsubscribe = bound(this).subscribe(() => this.render());
        this.render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }

    private render(): void {
        const setting = bound(this);
        const value = String(setting.get() ?? 'grey');
        const mode = modeOf(value);
        const label = t(this.getAttribute('label') ?? 'kit.key_color');
        const tiles = MODES.map((m) => `<button type="button" class="pi-choice-tile" data-mode="${m}" aria-pressed="${m === mode}"><span>${escapeHtml(t(`kit.key_color_${m}`))}</span></button>`);
        // label="" when a section title already says it
        this.innerHTML = `${label ? `<span class="pi-label">${escapeHtml(label)}</span>` : ''}
            <div class="pi-choice" style="--pi-choice-columns: 4">${tiles.join('')}</div>
            ${mode === 'fixed' ? `<div class="pi-row"><span class="pi-hint">${escapeHtml(value.toUpperCase())}</span><pi-swatch class="pi-color" value="${escapeHtml(value)}"></pi-swatch></div>` : ''}
            <div class="pi-hint">${escapeHtml(t(`kit.key_color_${mode}_hint`))}</div>`;
        this.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) =>
            el.addEventListener('click', () => {
                const m = el.dataset.mode as Mode;
                if (m === mode) return;
                setting.set(m === 'fixed' ? (this.getAttribute('fixed-default') ?? '#FFFFFF') : m);
            }),
        );
        this.querySelector<HTMLElement & { value: string }>('pi-swatch')?.addEventListener('change', (e) => setting.set((e.target as HTMLElement & { value: string }).value));
    }
}
