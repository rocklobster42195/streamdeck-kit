// The two corner badges of the universal transport keys (grill 2026-10-09, Q8c): the user picks
// what goes top left and top right: nothing, the key's marker, the source of what plays, or the
// battery. A dark disc with a 22 px picture, as MA-C's provider badge and marker were.
import {
    mdiBattery,
    mdiBattery10,
    mdiBattery20,
    mdiBattery30,
    mdiBattery40,
    mdiBattery50,
    mdiBattery60,
    mdiBattery70,
    mdiBattery80,
    mdiBattery90,
    mdiBatteryAlert,
    mdiBatteryCharging100,
    mdiBatteryChargingOutline,
    mdiBatteryCharging10,
    mdiBatteryCharging20,
    mdiBatteryCharging30,
    mdiBatteryCharging40,
    mdiBatteryCharging50,
    mdiBatteryCharging60,
    mdiBatteryCharging70,
    mdiBatteryCharging80,
    mdiBatteryCharging90,
    mdiBatteryOutline,
} from '@mdi/js';
import { KEY_SIZE } from '../render/key-style.js';

export type CornerChoice = 'none' | 'marker' | 'source' | 'battery';
export const CORNER_CHOICES: readonly CornerChoice[] = ['none', 'marker', 'source', 'battery'];

/** What one corner shows, ready to draw. */
export type CornerBadge =
    | { kind: 'icon'; path: string; color: string }
    /** A picture: a data: URI (Stream Deck doesn't load URLs inside a key image). */
    | { kind: 'image'; href: string };

/** Below this charge the battery counts as low (sonos-controller's value). */
export const BATTERY_LOW_PERCENT = 20;
/** "low": only while the battery is low (a red alert glyph); "always": the level, in colour. */
export type BatteryMode = 'low' | 'always';

const LEVEL = [mdiBatteryOutline, mdiBattery10, mdiBattery20, mdiBattery30, mdiBattery40, mdiBattery50, mdiBattery60, mdiBattery70, mdiBattery80, mdiBattery90, mdiBattery];
const CHARGING = [mdiBatteryChargingOutline, mdiBatteryCharging10, mdiBatteryCharging20, mdiBatteryCharging30, mdiBatteryCharging40, mdiBatteryCharging50, mdiBatteryCharging60, mdiBatteryCharging70, mdiBatteryCharging80, mdiBatteryCharging90, mdiBatteryCharging100];

/** The battery badge, or undefined when there's nothing to show (no battery, or "low" and it isn't). */
export function batteryBadge(battery: number | undefined, charging: boolean | undefined, mode: BatteryMode = 'low'): CornerBadge | undefined {
    if (battery === undefined || !Number.isFinite(battery)) return undefined;
    const low = battery <= BATTERY_LOW_PERCENT;
    if (mode === 'low') return low && !charging ? { kind: 'icon', path: mdiBatteryAlert, color: '#FF4D4D' } : undefined;
    const step = Math.max(0, Math.min(10, Math.round(battery / 10)));
    // The colour from the real charge, not the 10 % step of the glyph
    const color = low ? '#FF4D4D' : battery < 50 ? '#FFC24D' : '#4DDB6E';
    return { kind: 'icon', path: (charging ? CHARGING : LEVEL)[step], color };
}

/** SVG of a badge in the top-left or top-right corner of a key. */
export function cornerSvg(badge: CornerBadge | undefined, side: 'left' | 'right', size = KEY_SIZE): string {
    if (!badge) return '';
    const s = size / KEY_SIZE;
    const cx = (side === 'left' ? 24 : KEY_SIZE - 24) * s;
    const cy = 24 * s;
    const r = 18 * s;
    const pic = 22 * s;
    const x = cx - pic / 2;
    const y = cy - pic / 2;
    const disc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#101010" opacity="0.8"/>`;
    if (badge.kind === 'icon') return `${disc}<path transform="translate(${x} ${y}) scale(${pic / 24})" fill="${badge.color}" d="${badge.path}"/>`;
    const id = `corner-${side}`;
    return `${disc}<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${pic / 2}"/></clipPath><image href="${badge.href}" x="${x}" y="${y}" width="${pic}" height="${pic}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`;
}
