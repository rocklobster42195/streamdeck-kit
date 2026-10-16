import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';
import { bound } from './bound.js';

const MODES = ['grey', 'cover', 'row', 'fixed'] as const;
type Mode = (typeof MODES)[number];

// Stream Deck device types without dials (the SDK's DeviceType): they have no Panorama row, so "Like the
// Panorama" means nothing there (0 Stream Deck, 1 Mini, 2 XL, 3 Mobile, 4 Corsair G-Keys, 5 Pedal,
// 6 Corsair Voyager, 8 SCUF, 9 Neo); the others (+, + XL, Studio, Galleon, virtual) and unknown types keep the tile
const NO_DIALS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 8, 9]);

/** Whether the Stream Deck this key sits on can have a Panorama row (false only for a known dial-less device). */
function hasPanorama(): boolean {
    const devices = sd.info?.devices;
    const dev = Array.isArray(devices) ? (devices as { id?: string; type?: number }[]).find((d) => d.id === sd.actionInfo?.device) : undefined;
    return !(typeof dev?.type === 'number' && NO_DIALS.has(dev.type));
}

const modeOf = (v: string): Mode => (/^#[0-9a-f]{6}$/i.test(v) ? 'fixed' : (MODES as readonly string[]).includes(v) ? (v as Mode) : 'grey');

/**
 * <pi-key-color setting="keyColor" [label="…" | label=""] [fixed-default="#87AE73"]
 *               [grey-label="pi.key_color_default" grey-hint="…"]> — a key's colour (grill
 * 2026-10-04): Grey (today's look, the default), Cover (the key's player), Like the Panorama (the
 * row colour of the key's Stream Deck) or a fixed colour from the colour picker. Stored as "grey",
 * "cover", "row" or "#RRGGBB" (see resolveKeyColor). `grey-label`/`grey-hint` rename the first tile
 * for a plugin whose look from before isn't plain grey (MA-C: grey with blue "on" states).
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
        // A key already set to the row colour keeps its tile, so the choice never goes missing
        const modes = hasPanorama() || mode === 'row' ? MODES : MODES.filter((m) => m !== 'row');
        const label = t(this.getAttribute('label') ?? 'kit.key_color');
        const text = (m: Mode, part = '') => (m === 'grey' && this.getAttribute(`grey-${part || 'label'}`)) || `kit.key_color_${m}${part ? `_${part}` : ''}`;
        const tiles = modes.map((m) => `<button type="button" class="pi-choice-tile" data-mode="${m}" aria-pressed="${m === mode}"><span>${escapeHtml(t(text(m)))}</span></button>`);
        // label="" when a section title already says it
        this.innerHTML = `${label ? `<span class="pi-label">${escapeHtml(label)}</span>` : ''}
            <div class="pi-choice" style="--pi-choice-columns: ${modes.length}">${tiles.join('')}</div>
            ${mode === 'fixed' ? `<div class="pi-row"><span class="pi-hint">${escapeHtml(value.toUpperCase())}</span><pi-swatch class="pi-color" value="${escapeHtml(value)}"></pi-swatch></div>` : ''}
            <div class="pi-hint">${escapeHtml(t(text(mode, 'hint')))}</div>`;
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
