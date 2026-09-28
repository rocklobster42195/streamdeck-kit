// PI translations. The plugin's build bundles the "Localization" blocks of its <lang>.json files
// into window.PI_LOCALES, so one JSON file per language serves manifest, plugin and PI alike.
import { sd } from './sd-client.js';

type Dict = { [key: string]: string | Dict };

function locales(): Record<string, Dict> {
    return ((window as any).PI_LOCALES ?? {}) as Record<string, Dict>;
}

/**
 * Look up a key in a locale. Like the plugin SDK, dotted keys are paths into nested groups
 * ("pi.player" → Localization.pi.player); a flat key that itself contains dots (manifest
 * sentences) is tried first.
 */
function lookup(dict: Dict | undefined, key: string): string | undefined {
    if (!dict) return undefined;
    const flat = dict[key];
    if (typeof flat === "string") return flat;
    let node: string | Dict | undefined = dict;
    for (const part of key.split(".")) node = typeof node === "object" ? node[part] : undefined;
    return typeof node === "string" ? node : undefined;
}

/** Translate a key; falls back to English, then to the key itself. `{name}` placeholders are filled from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
    const all = locales();
    let text = lookup(all[sd.language], key) ?? lookup(all.en, key) ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
}

/** Apply data-i18n (textContent) and data-i18n-placeholder attributes below `root`. */
export function translateDom(root: ParentNode = document): void {
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n!)));
    root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder!)));
}
