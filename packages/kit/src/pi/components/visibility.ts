import { sd } from '../sd-client.js';

/**
 * Show elements only for certain setting values: `data-show-when="command=up,down"` (action
 * settings; prefix the key with "global:" for global settings). Re-evaluated on every change.
 */
export function initConditionalVisibility(root: ParentNode = document): void {
    const apply = () =>
        root.querySelectorAll<HTMLElement>('[data-show-when]').forEach((el) => {
            const [rawKey, values] = (el.dataset.showWhen ?? '').split('=');
            const global = rawKey.startsWith('global:');
            const key = global ? rawKey.slice(7) : rawKey;
            const current = String((global ? sd.globalSettings : sd.settings)[key] ?? el.dataset.showDefault ?? '');
            el.hidden = !values.split(',').includes(current);
        });
    sd.onSettings(apply);
    sd.onGlobalSettings(apply);
    apply();
}
