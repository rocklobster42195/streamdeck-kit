import { sd } from '../sd-client.js';

/** Read/write a setting, action-level or global depending on the element's `global` attribute. */
export function bound(el: HTMLElement) {
    const key = el.getAttribute('setting') ?? '';
    const global = el.hasAttribute('global');
    return {
        get: (): unknown => (global ? sd.globalSettings : sd.settings)[key],
        set: (value: unknown) => (global ? sd.setGlobalSetting(key, value) : sd.setSetting(key, value)),
        subscribe: (fn: () => void) => (global ? sd.onGlobalSettings(fn) : sd.onSettings(fn)),
    };
}
