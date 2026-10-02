// Effect inputs from outside (e.g. Home Assistant entities): a colour from whatever form it comes
// in, and a number scaled onto an effect setting's range. Hosts read their sources and pass the
// results to the Panorama as live settings (see PanoramaEngine.updateLive), which win over the
// settings the user picked.
import { hsvToHex, normalizeHex, rgbToHex } from '../pi/color-math.js';
import { STANDARD_COLORS } from '../pi/standard-colors.js';
import { effectRegistry } from './registry.js';

/** Colour words people put into a text helper (English and German). */
const NAMED: Record<string, string> = {
    white: '#FFFFFF', weiss: '#FFFFFF', weiß: '#FFFFFF',
    black: '#000000', schwarz: '#000000',
    red: '#FF0000', rot: '#FF0000',
    green: '#00C000', grün: '#00C000', gruen: '#00C000',
    blue: '#0066FF', blau: '#0066FF',
    yellow: '#FFD500', gelb: '#FFD500',
    orange: '#FF8800',
    purple: '#8A2BE2', violet: '#8A2BE2', lila: '#8A2BE2', violett: '#8A2BE2',
    pink: '#FF4FA3', magenta: '#FF00FF',
    cyan: '#00D0FF', türkis: '#00C8C8', tuerkis: '#00C8C8', turquoise: '#00C8C8',
    brown: '#8B5A2B', braun: '#8B5A2B',
    grey: '#808080', gray: '#808080', grau: '#808080',
};

/**
 * A colour as "#RRGGBB" from: "#f80", "#FF8800", "255,136,0", "rgb(255, 136, 0)", [255, 136, 0],
 * "hs(30, 100)" / { h, s } (hue °, saturation %, as HA's hs_color), a colour word or one of the
 * standard colours' names. Undefined when it isn't a colour.
 */
export function parseColor(value: unknown): string | undefined {
    if (Array.isArray(value)) return fromNumbers(value.map(Number));
    if (value && typeof value === 'object') {
        const o = value as Record<string, unknown>;
        if ('r' in o && 'g' in o && 'b' in o) return fromNumbers([Number(o.r), Number(o.g), Number(o.b)]);
        if ('h' in o && 's' in o) return fromHs(Number(o.h), Number(o.s));
        return undefined;
    }
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    const hex = normalizeHex(text);
    if (hex) return hex;
    const hs = /^hs\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i.exec(text);
    if (hs) return fromHs(Number(hs[1]), Number(hs[2]));
    const nums = /^(?:rgb\s*)?\(?\s*([\d.]+)\s*[,; ]\s*([\d.]+)\s*[,; ]\s*([\d.]+)\s*\)?$/i.exec(text);
    if (nums) return fromNumbers([Number(nums[1]), Number(nums[2]), Number(nums[3])]);
    const word = text.toLowerCase();
    if (NAMED[word]) return NAMED[word];
    const standard = STANDARD_COLORS.find((c) => c.name.toLowerCase() === word);
    return standard ? normalizeHex(standard.hex) : undefined;
}

function fromNumbers(n: number[]): string | undefined {
    if (n.length < 3 || n.slice(0, 3).some((x) => !Number.isFinite(x) || x < 0 || x > 255)) return undefined;
    return rgbToHex({ r: n[0], g: n[1], b: n[2] });
}

function fromHs(h: number, s: number): string | undefined {
    if (!Number.isFinite(h) || !Number.isFinite(s)) return undefined;
    return hsvToHex({ h: ((h % 360) + 360) % 360, s: Math.min(1, Math.max(0, s / 100)), v: 1 });
}

/** The range of one setting of an effect (e.g. savedSpeed of particles), from its settings schema. */
export function effectRange(effectId: string, key: string): { min: number; max: number; step?: number } | undefined {
    const field = effectRegistry.get(effectId)?.settingsSchema.find((f) => f.key === key) as { min?: number; max?: number; step?: number } | undefined;
    if (typeof field?.min !== 'number' || typeof field.max !== 'number') return undefined;
    return { min: field.min, max: field.max, step: field.step };
}

/**
 * `value` between `min` and `max` mapped onto the effect setting's range (rounded to its step);
 * undefined when the effect has no such setting or the value isn't a number.
 */
export function scaleToEffect(effectId: string, key: string, value: number, min: number, max: number): number | undefined {
    const range = effectRange(effectId, key);
    if (!range || !Number.isFinite(value) || !(max > min)) return undefined;
    const f = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const raw = range.min + f * (range.max - range.min);
    if (!range.step) return raw;
    const stepped = range.min + Math.round((raw - range.min) / range.step) * range.step;
    return Math.min(range.max, Math.max(range.min, Number(stepped.toFixed(6))));
}
