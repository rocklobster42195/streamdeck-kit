// The universal Volume dial's picture (grill 2026-10-09; the look of Sonos Controller's dial, the
// user's choice after the previews): the volume as a pie, ring or open ring on a 200×100 strip,
// the number as text beside it with the player's name below. Muted, the gauge turns grey with a
// red speaker inside. SDK-free.
import { mdiVolumeOff } from '@mdi/js';
import { arc } from './gauge/arc.js';
import { openRing } from './gauge/open-ring.js';
import { pie } from './gauge/pie.js';
import { mdi, scrimBox, scrimDisc, stripImage, text, textWidth } from './strip.js';
import { volumeIcon } from '../transport/volume-keys.js';
import { statusBadge, type StatusKind } from './status-badge.js';
import { mdiTimerSand } from '@mdi/js';

export type VolumeDialGauge = 'ring' | 'pie' | 'open';

export type VolumeDialView = {
    name: string;
    /** The number shown (the target). */
    volume: number;
    /** What the gauge fills to while it glides there; default the volume. */
    gaugeVolume?: number;
    muted: boolean;
    gauge?: VolumeDialGauge;
    align?: 'left' | 'center' | 'right';
    showText?: boolean;
    /** The gauge's colour. */
    color?: string;
    /** MDI path the user chose (inside the ring, or in the opening of the open ring). */
    icon?: string;
    /** No player or no volume to show: an empty, dimmed gauge. */
    unavailable?: boolean;
    /** The word shown for a muted player. */
    mutedLabel: string;
    /** A saved preset: a green check instead of the gauge for a moment. */
    saved?: boolean;
    /** What the effect shows behind the dial (a Panorama slice); the scrims go on top of it. */
    underlay?: string;
    /** What the player is doing about a command (a corner badge). */
    status?: StatusKind;
};

const MUTED = '#ff8a8a';
const MUTED_GAUGE = '#5a5a60';
const DIM = '#4a4a50';
const SAVED = '#4caf50';
const NUMBER = '#ffffff';

export function renderVolumeDial(v: VolumeDialView): string {
    const gauge = v.gauge ?? 'ring';
    const align = v.align ?? 'left';
    const showText = v.showText !== false;
    const cx = align === 'center' ? 100 : align === 'right' ? 150 : 50;
    const volume = Math.round(Math.min(100, Math.max(0, v.volume)));
    const parts: string[] = [];
    let scrim = '';

    if (v.saved) {
        parts.push(mdi('M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z', cx - 38, 12, 76, SAVED));
        return stripImage(parts, undefined, v.underlay ? v.underlay + scrimDisc(cx, 50, 42) : undefined);
    }

    // Gauge
    const empty = v.muted || v.unavailable;
    const color = v.unavailable ? DIM : v.muted ? MUTED_GAUGE : (v.color ?? '#cccccc');
    const fill = (empty ? 0 : Math.min(100, Math.max(0, v.gaugeVolume ?? volume))) / 100;
    if (gauge === 'pie') {
        parts.push(...pie(cx, 50, 38, fill, color));
        scrim += scrimDisc(cx, 50, 42);
    } else if (gauge === 'open') {
        parts.push(...openRing({ cx, cy: 50, r: 34, width: 8, min: 0, max: 100, value: fill * 100, zones: [{ from: -Infinity, color }] }));
        scrim += scrimDisc(cx, 50, 30);
    } else {
        parts.push(...arc(cx, 50, 34, fill, color));
        scrim += scrimDisc(cx, 50, 30);
    }

    // Inside the gauge: the red speaker while muted; centred, the number (no room beside the gauge);
    // otherwise the user's icon or the speaker for this volume. The open ring's sits in its opening.
    const centred = showText && align === 'center' && !v.unavailable;
    if (v.status === 'loading') {
        // A command takes a while: the hourglass in the middle of the gauge
        parts.push(mdi(mdiTimerSand, cx - 16, 34, 32, '#e0e0e0'));
    } else if (v.muted && !v.unavailable) {
        parts.push(mdi(mdiVolumeOff, cx - 16, 34, 32, MUTED));
    } else if (centred && gauge !== 'pie') {
        parts.push(text(cx, gauge === 'open' ? 54 : 57, `${volume}%`, { size: 18, weight: 'bold', anchor: 'middle', color: NUMBER }));
    } else if (gauge !== 'pie') {
        const path = v.icon ?? volumeIcon(volume);
        // As in Sonos Controller: the chosen icon fills the ring (32 px); in the opening it is 24 px
        const big = !!v.icon && gauge === 'ring';
        parts.push(mdi(path, cx - (big ? 16 : 12), gauge === 'open' ? 65 : big ? 34 : 38, big ? 32 : 24, v.icon && !v.unavailable ? color : '#8a8a90'));
    }
    // A centred pie has the number on the wedge, in a small chip
    if (centred && gauge === 'pie' && !v.muted) {
        const w = textWidth(`${volume}%`, 18, { bold: true }) + 14;
        scrim += scrimBox(cx - w / 2, 37, w, 26);
        parts.push(text(cx, 56, `${volume}%`, { size: 18, weight: 'bold', anchor: 'middle', color: NUMBER }));
    }

    // Beside it: the number (or "muted") and the name
    if (showText && align !== 'center') {
        const anchor = align === 'right' ? 'end' : 'start';
        const tx = align === 'right' ? 96 : 100;
        const big = v.unavailable ? '—' : v.muted ? v.mutedLabel : `${volume}%`;
        const w = Math.max(textWidth(big, 18, { bold: true, maxWidth: 92 }), textWidth(v.name, 11, { maxWidth: 92 })) + 12;
        scrim += scrimBox(anchor === 'end' ? tx + 6 - w : tx - 6, 30, w, 42);
        parts.push(
            text(tx, 46, big, { size: 18, weight: 'bold', maxWidth: 92, anchor, color: v.unavailable ? DIM : v.muted ? MUTED : NUMBER }),
            text(tx, 64, v.name, { size: 11, color: '#cccccc', maxWidth: 92, anchor }),
        );
    }
    if (v.status === 'failed') parts.push(statusBadge(v.status, 4, 80));
    return stripImage(parts, undefined, v.underlay ? v.underlay + scrim : undefined);
}
