import { mdiBattery60, mdiCancel, mdiMusicNote, mdiTagOutline } from '@mdi/js';
import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';

type Name = 'left' | 'right' | 'battery';

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
 *             [marker-setting="marker"] [default-left="marker"] [default-right="source"]> — what
 * the two top corners of a transport key show (grill 2026-10-09): nothing, the key's marker, the
 * source of what plays, or the battery. With a marker in a corner the card also picks the marker's
 * icon; with the battery, when it shows (only when low, or always). Built once and then only
 * updated, so a marker search in progress survives a settings change.
 */
export class PiCorners extends HTMLElement {
    private unsubscribe?: () => void;

    connectedCallback(): void {
        this.classList.add('pi-corners');
        const row = (name: Name, label: string, options: { value: string; label: string; icon?: string }[], columns: number) =>
            `<div class="pi-corner-row" data-row="${name}"><span class="pi-label">${escapeHtml(t(label))}</span><div class="pi-choice" style="--pi-choice-columns: ${columns}">${options
                .map(
                    (o) => `<button type="button" class="pi-choice-tile" data-name="${name}" data-value="${escapeHtml(o.value)}">
                    ${o.icon ? `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${o.icon}"/></svg>` : ''}
                    <span>${escapeHtml(t(o.label))}</span></button>`,
                )
                .join('')}</div></div>`;
        this.innerHTML =
            row('left', 'kit.corner_left', CORNERS, 4) +
            row('right', 'kit.corner_right', CORNERS, 4) +
            row('battery', 'kit.corner_battery_when', BATTERY, 2) +
            `<pi-icon-picker class="pi-corner-marker" setting="${escapeHtml(this.key('marker'))}" none-label="kit.marker_none" reset-label="kit.marker_remove" hint="kit.marker_hint"></pi-icon-picker>`;
        this.querySelectorAll<HTMLElement>('.pi-choice-tile').forEach((el) =>
            el.addEventListener('click', () => {
                sd.setSetting(this.key(el.dataset.name as Name), el.dataset.value);
                this.update();
            }),
        );
        this.unsubscribe = sd.onSettings(() => this.update());
        this.update();
    }

    disconnectedCallback(): void {
        this.unsubscribe?.();
    }

    private key(name: Name | 'marker'): string {
        return this.getAttribute(`${name}-setting`) ?? { left: 'topLeft', right: 'topRight', battery: 'battery', marker: 'marker' }[name];
    }

    private value(name: Name): string {
        const fallback = name === 'battery' ? 'low' : (this.getAttribute(`default-${name}`) ?? (name === 'left' ? 'marker' : 'source'));
        return String(sd.settings[this.key(name)] ?? fallback);
    }

    private update(): void {
        this.querySelectorAll<HTMLElement>('.pi-choice-tile').forEach((el) => el.setAttribute('aria-pressed', String(this.value(el.dataset.name as Name) === el.dataset.value)));
        const shows = (what: string) => this.value('left') === what || this.value('right') === what;
        this.querySelector<HTMLElement>('[data-row="battery"]')!.hidden = !shows('battery');
        this.querySelector<HTMLElement>('.pi-corner-marker')!.hidden = !shows('marker');
    }
}
