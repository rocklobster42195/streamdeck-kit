// A level dial's touch-strip segment (200×100), the same in every plugin with levels (XR-C's
// faders and sends, SA-C's output and apps, …), in four looks:
//   "digital": name and value on top, LED bars lying (one per channel), a scale, and the position
//              (volume, fader) as a slim bar underneath
//   "classic": analog VU meters (one or two), the name and value as a caption
//   "ring" / "pie": just the position as a ring or a pie, name and value next to it
// Muted: the value turns into "MUTE" in red, the meter is dimmed. Inactive (e.g. an app that isn't
// running): everything grey, no level. Over a Panorama effect (`background`) only the circle, each
// text line and each meter row get a dark backing; the effect shows in the gaps.
import { mdiVolumeOff } from '@mdi/js';
import { arc } from './gauge/arc.js';
import { meterBar, meterScaleMarks } from './gauge/bar.js';
import { pie } from './gauge/pie.js';
import { METER_TICKS } from './gauge/scale.js';
import { vuMeter } from './gauge/vu.js';
import { escapeXml, mdi, scrimDisc, stripImage, text, textWidth } from './strip.js';

export type LevelStyle = 'digital' | 'classic' | 'ring' | 'pie';

/** The name line: white (default), the name in the colour, or a coloured band (like a console's scribble strip). */
export type LevelHeader = 'plain' | 'color' | 'strip';

export type LevelStripView = {
    style: LevelStyle;
    name: string;
    /** A second name line in the ring and pie looks (e.g. a send's "→ Reverb"); after the name otherwise. */
    subName?: string;
    /** The value as shown: "−3.5 dB", "42 %". */
    valueText: string;
    /** The position 0..1 (ring, pie, the bar under the meter); undefined: unknown (drawn empty). */
    position: number | undefined;
    /** The dial's colour: value, ring, bar. */
    color: string;
    muted: boolean;
    /** Not running or unavailable: all grey, no level. */
    inactive?: boolean;
    /** Levels and peaks in dBFS, VU needle positions; one per channel (mono 1, stereo 2). */
    levels: number[];
    peaks: number[];
    vus: number[];
    /** A small note to the value, e.g. a send's tap ("PRE"). */
    caption?: string;
    /** An image next to the name (in the ring for ring and pie), e.g. an app's icon (data URI). */
    icon?: string;
    header?: LevelHeader;
    /** For the band header: dark band with frame and text in the colour (an inverted scribble strip). */
    inverted?: boolean;
    /** Draws the position under the meter (digital); default a slim bar. XR-C draws its fader travel. */
    positionBar?: (x: number, y: number, width: number, position: number, color: string) => string;
    /** The Panorama effect's slice behind the dial (SVG fragment), if it shows one. */
    background?: string;
};

const MUTED = '#ff5a5a';
const GREY = '#5a5a60';
const INK_GREY = '#8a8a90';

/** Looks that show the level (the plugin needs meter data only for these). */
export function levelStyleShowsMeter(style: LevelStyle): boolean {
    return style === 'digital' || style === 'classic';
}

export function renderLevelStrip(v: LevelStripView): string {
    if (v.style === 'classic') return classic(v);
    if (v.style === 'ring' || v.style === 'pie') return gauge(v);
    return digital(v);
}

/** Black or white, whichever reads better on `hex`. */
export function inkOn(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return l > 0.4 ? '#000000' : '#FFFFFF';
}

/** A dark box behind one element over an effect: only where something is drawn. */
function shade(x: number, y: number, w: number, h: number): string {
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="#000" opacity="0.55"/>`;
}

/** The box behind a text line, `x`/`baseline` as drawn. */
function shadeText(x: number, baseline: number, value: string, size: number, opts: { bold?: boolean; maxWidth?: number; anchor?: 'start' | 'end' } = {}): string {
    const w = Math.min(textWidth(value, size, { bold: opts.bold }), opts.maxWidth ?? Infinity);
    const left = opts.anchor === 'end' ? x - w : x;
    return shade(left - 4, baseline - size + 1, w + 8, size + 4);
}

const image = (href: string, x: number, y: number, size: number) => `<image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;

function slimBar(x: number, y: number, width: number, position: number, color: string): string {
    return `<rect x="${x}" y="${y}" width="${width}" height="5" rx="2.5" fill="#2a2b30"/><rect x="${x}" y="${y}" width="${(width * position).toFixed(1)}" height="5" rx="2.5" fill="${color}"/>`;
}

/** Ring or pie with the position, the name and value next to it. */
function gauge(v: LevelStripView): string {
    const showMute = v.muted && !v.inactive;
    const color = v.inactive || v.muted ? GREY : v.color;
    const top = v.subName ? 34 : 44;
    const y = v.subName ? 71 : 64;
    const value = showMute ? 'MUTE' : v.valueText;
    const scrims = v.background
        ? [
              scrimDisc(50, 50, 44),
              shadeText(100, top, v.name, 14, { bold: true, maxWidth: 94 }),
              v.subName ? shadeText(100, 51, v.subName, 12, { maxWidth: 94 }) : '',
              shadeText(100, y, value, showMute ? 13 : 14, { bold: true, maxWidth: 94 }),
              v.caption && !showMute ? shadeText(100, y + 15, v.caption, 10) : '',
          ]
        : [];
    const position = v.position ?? 0;
    const parts = [...scrims, ...(v.style === 'pie' ? pie(50, 50, 38, v.muted ? 0 : position, color) : arc(50, 50, 34, position, color))];
    if (showMute) parts.push(mdi(mdiVolumeOff, 34, 34, 32, MUTED));
    else if (v.icon) parts.push(v.style === 'pie' ? image(v.icon, 30, 30, 40) : image(v.icon, 32, 32, 36));
    // A band next to the circle looks odd: "strip" colours the name like "color"
    const nameColor = v.inactive ? INK_GREY : (v.header ?? 'plain') !== 'plain' ? v.color : undefined;
    parts.push(text(100, top, v.name, { size: 14, weight: 'bold', maxWidth: 94, color: nameColor }));
    if (v.subName) parts.push(text(100, 51, v.subName, { size: 12, color: '#a4a4aa', maxWidth: 94 }));
    parts.push(showMute ? text(100, y, 'MUTE', { size: 13, weight: 'bold', color: MUTED }) : text(100, y, v.valueText, { size: 14, weight: 'bold', color: v.inactive ? GREY : v.color, maxWidth: 94 }));
    if (v.caption && !showMute) parts.push(text(100, y + 15, v.caption, { size: 10, color: INK_GREY }));
    return stripImage(parts, undefined, v.background);
}

function digital(v: LevelStripView): string {
    const w = 184;
    const bx = 8;
    const showMute = v.muted && !v.inactive;
    const marker = v.muted || v.inactive ? GREY : v.color;
    const name = v.subName ? `${v.name} ${v.subName}` : v.name;
    // The name gets what the value leaves free
    const right = showMute ? textWidth('MUTE', 12, { bold: true }) + 22 : textWidth(v.valueText, 13, { bold: true });
    const header = v.header ?? 'plain';
    // "strip": the name line as a coloured band with black or white text; an inverted colour stays
    // dark with frame and text in the colour, as on a console
    const invertedBand = header === 'strip' && !!v.inverted && !v.muted;
    const band = header === 'strip' ? (v.muted || v.inactive ? '#3a3a40' : invertedBand ? '#101010' : v.color) : undefined;
    const ink = invertedBand ? v.color : band ? inkOn(band) : undefined;
    const nameX = v.icon ? 32 : 8;
    const nameMax = Math.max(60, 192 - nameX - right - 10);
    const scrims = v.background
        ? [
              band ? '' : v.icon ? shade(2, 4, Math.min(textWidth(name, 14, { bold: true }), nameMax) + 38, 18) : shadeText(nameX, 18, name, 14, { bold: true, maxWidth: nameMax }),
              band ? '' : showMute ? shade(192 - right - 4, 4, right + 8, 18) : shadeText(192, 18, v.valueText, 13, { bold: true, anchor: 'end' }),
              shade(bx - 3, 27, w + 6, 28),
              shade(bx - 3, 56, w + 6, 17),
              shade(bx - 3, 81, w + 6, 14),
          ]
        : [];
    const parts = [
        ...scrims,
        band ? `<rect x="3" y="2" width="194" height="23" rx="5" fill="${band}"${invertedBand ? ` stroke="${v.color}" stroke-width="1.5"` : ''}/>` : '',
        v.icon ? image(v.icon, 6, 3, 20) : '',
        text(nameX, 18, name, { size: 14, weight: 'bold', maxWidth: nameMax, color: v.inactive ? INK_GREY : (ink ?? (header === 'color' ? v.color : undefined)) }),
        showMute
            ? `${mdi(mdiVolumeOff, 192 - textWidth('MUTE', 12, { bold: true }) - 22, 4, 18, MUTED)}${text(192, 18, 'MUTE', { size: 12, weight: 'bold', color: MUTED, anchor: 'end' })}`
            : text(192, 18, v.valueText, { size: 13, weight: 'bold', color: v.inactive ? GREY : (ink ?? v.color), anchor: 'end' }),
        ...meterBar({ x: bx, y: 30, length: w, thickness: 22, levels: v.inactive ? Array<number>(v.levels.length || 2).fill(-128) : v.levels, peaks: v.inactive ? undefined : v.peaks, segments: 36, off: v.muted || v.inactive ? '#1a1c20' : undefined }),
        ...meterScaleMarks(bx, 57, w, METER_TICKS),
        (v.positionBar ?? slimBar)(bx, 86, w, v.position ?? 0, marker),
    ];
    // A small note (e.g. a send's tap) at the bottom right, under the scale
    if (v.caption && !showMute) parts.push(text(192, 81, v.caption, { size: 9, color: INK_GREY, anchor: 'end' }));
    // A muted channel's meter may still move (it can be metered before the mute); dim it
    if (showMute) parts.push(`<rect x="${bx}" y="30" width="${w}" height="22" fill="#000" opacity="0.45"/>`);
    return stripImage(parts, undefined, v.background);
}

function classic(v: LevelStripView): string {
    const parts: string[] = [];
    if (v.vus.length === 1) parts.push(...vuMeter({ x: 40, y: 4, width: 120, height: 82, vu: v.vus[0], label: 'MONO', id: 'vm' }));
    else {
        parts.push(...vuMeter({ x: 4, y: 6, width: 94, height: 80, vu: v.vus[0], label: 'LEFT', id: 'vl' }));
        parts.push(...vuMeter({ x: 102, y: 6, width: 94, height: 80, vu: v.vus[1], label: 'RIGHT', id: 'vr' }));
    }
    const showMute = v.muted && !v.inactive;
    const value = showMute ? 'MUTE' : v.caption ? `${v.valueText} ${v.caption}` : v.valueText;
    const caption = `${escapeXml((v.subName ? `${v.name} ${v.subName}` : v.name).toUpperCase())} · ${escapeXml(value)}`;
    // Not running: the meters dimmed like a switched-off device
    if (v.inactive) parts.push(`<rect width="200" height="100" fill="#000" opacity="0.55"/>`);
    // Over an effect: a box behind the caption (letter-spaced, so a little wider than measured)
    if (v.background) parts.push(shade(100 - textWidth(caption, 9) / 2 - 18, 88, textWidth(caption, 9) + 36, 13));
    parts.push(`<text x="100" y="97" font-family="Arial,sans-serif" font-size="9" fill="${v.inactive ? INK_GREY : showMute ? MUTED : '#bfa76a'}" text-anchor="middle" letter-spacing="1.5">${caption}</text>`);
    return stripImage(parts, '#141210', v.background);
}

/** Not ready (setup, offline, nothing chosen …): an icon, a line and a hint. */
export function renderLevelMessage(iconPath: string, iconColor: string, label: string, hint: string): string {
    return stripImage([mdi(iconPath, 16, 34, 32, iconColor), text(60, 46, label, { size: 14, weight: 'bold', maxWidth: 132 }), text(60, 64, hint, { size: 11, color: '#a4a4aa', maxWidth: 132 })]);
}
