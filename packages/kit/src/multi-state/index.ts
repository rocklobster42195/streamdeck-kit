// The Multi-state key (from HA-C, SA-C grill 2026-10-05): a key that steps through a list of states
// (a fan's speeds, a mode, audio devices, scenes), each with its own name, icon and colour, and
// shows the current one. The plugin decides what a state means and how to reach it; the kit has
// the list (as stored by <pi-states>), the stepping and the picture.
import { mdiCloudOffOutline, mdiHelpCircleOutline } from '@mdi/js';
import { KEY_SIZE, keyCaption, keyIcon, keySvg } from '../render/key-style.js';

export type StateOption = {
    /** What the plugin sends or matches ("1", "low", a device id). */
    value: string;
    /** Shown on the key; the value when empty. */
    label?: string;
    /** MDI icon name. */
    icon?: string;
    color?: string;
};

/** The usable states from the settings (rows without a value are skipped). */
export function stateOptions(raw: unknown): StateOption[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((o): o is StateOption => !!o && typeof o === 'object' && typeof (o as StateOption).value === 'string' && (o as StateOption).value.trim() !== '')
        .map((o) => ({ value: o.value.trim(), label: o.label, icon: o.icon, color: o.color }));
}

/** The state after `index`, wrapping around; the first one when the current state is unknown. */
export function nextIndex(index: number, count: number): number {
    return count ? (index < 0 ? 0 : (index + 1) % count) : -1;
}

export type MultiStateKeyView = {
    /** -1 when the current state is none of them. */
    index: number;
    count: number;
    /** MDI path. */
    icon: string;
    color: string;
    /** The state's name (or value); the key's own name when unknown. */
    text?: string;
    offline: boolean;
    /** The state's name in its colour instead of white. */
    colorCaption?: boolean;
};

const DIM = '#7a7a80';

/**
 * The key: the current state's icon in its colour, its name below, and a row of dots for where it
 * is in the list (up to 8). Unknown: grey with a question mark; offline: dimmed with a cloud.
 */
export function renderMultiStateKey(v: MultiStateKeyView): string {
    const known = v.index >= 0;
    const ink = v.offline || !known ? DIM : v.color;
    const parts = [keyIcon(v.icon, { size: 76, x: 34, y: 4 }, ink, v.offline ? 0.35 : 1)];
    if (v.text) parts.push(keyCaption(v.text, v.offline || !known ? DIM : v.colorCaption ? v.color : '#FFFFFF', { y: 104, max: 22, min: 13 }));
    const n = Math.min(v.count, 8);
    const gap = 14;
    const x0 = KEY_SIZE / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
        const on = i === v.index;
        parts.push(`<circle cx="${x0 + i * gap}" cy="122" r="${on ? 5 : 3.5}" fill="${on && !v.offline ? v.color : '#4a4a50'}"/>`);
    }
    if (!known && !v.offline) parts.push(keyIcon(mdiHelpCircleOutline, { size: 30, x: KEY_SIZE - 40, y: 8 }, '#c8c8cc'));
    if (v.offline) parts.push(keyIcon(mdiCloudOffOutline, { size: 30, x: KEY_SIZE - 40, y: 8 }, '#ff6b6b'));
    return keySvg(parts);
}
