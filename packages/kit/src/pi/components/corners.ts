import { mdiBattery60, mdiCancel, mdiMusicNote, mdiTagOutline } from '@mdi/js';
import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';

const CORNERS: { value: string; label: string; icon: string }[] = [
    { value: 'none', label: 'kit.corner_none', icon: mdiCancel },
    { value: 'marker', label: 'kit.corner_marker', icon: mdiTagOutline },
    { value: 'source', label: 'kit.corner_source', icon: mdiMusicNote },
    { value: 'battery', label: 'kit.corner_battery', icon: mdiBattery60 },
];
const BATTERY: { value: string; label: string }[] = [
    { value: 'low', label: 'kit.battery_low' },
    { value: 'always', label: 'kit.battery_always' },
];

/**
 * <pi-corners [left-setting="topLeft"] [right-setting="topRight"] [battery-setting="battery"]
 *             [default-left="marker"] [default-right="source"]> — what the two top corners of a
 * transport key show (grill 2026-10-09): nothing, the key's marker, the source of what plays, or
 * the battery; with the battery in a corner, also when it shows (only when low, or always).
 */
export class PiCorners extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        this.classList.add('pi-corners');
        this.unsubscribe = sd.onSettings(() => this.render());
        this.render();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }

    private key(name: 'left' | 'right' | 'battery'): string {
        return this.getAttribute(`${name}-setting`) ?? { left: 'topLeft', right: 'topRight', battery: 'battery' }[name];
    }

    private value(name: 'left' | 'right' | 'battery'): string {
        const fallback = name === 'battery' ? 'low' : (this.getAttribute(`default-${name}`) ?? (name === 'left' ? 'marker' : 'source'));
        return String(sd.settings[this.key(name)] ?? fallback);
    }

    private render(): void {
        const row = (name: 'left' | 'right' | 'battery', label: string, options: { value: string; label: string; icon?: string }[], columns: number) => {
            const value = this.value(name);
            const tiles = options
                .map(
                    (o) => `<button type="button" class="pi-choice-tile" data-name="${name}" data-value="${escapeHtml(o.value)}" aria-pressed="${o.value === value}">
                    ${o.icon ? `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${o.icon}"/></svg>` : ''}
                    <span>${escapeHtml(t(o.label))}</span></button>`,
                )
                .join('');
            return `<span class="pi-label">${escapeHtml(t(label))}</span><div class="pi-choice" style="--pi-choice-columns: ${columns}">${tiles}</div>`;
        };
        const battery = this.value('left') === 'battery' || this.value('right') === 'battery';
        this.innerHTML = row('left', 'kit.corner_left', CORNERS, 4) + row('right', 'kit.corner_right', CORNERS, 4) + (battery ? row('battery', 'kit.corner_battery_when', BATTERY, 2) : '');
        this.querySelectorAll<HTMLElement>('.pi-choice-tile').forEach((el) =>
            el.addEventListener('click', () => {
                sd.setSetting(this.key(el.dataset.name as 'left' | 'right' | 'battery'), el.dataset.value);
                this.render();
            }),
        );
    }
}
