// A calm, static background: the row's colour, optionally fading to dark across the whole row. No tick,
// no motion. The colour itself comes from the row (Cover / fixed / default, see the Panorama PI), which
// writes it into `color`; the PI hides colour fields of effects, so there is no second colour to pick.
import type { EffectDefinition, EffectInstance, PanoramaInitContext } from '../../types.js';

export interface ColourEffectSettings {
    color?: string;
    /** Fade the colour towards black from the left of the row to its right. */
    fade?: boolean;
    /** How far it fades, 0-100 (%). */
    fadeAmount?: number;
}

// The family's sage green: a colour that shows ("the effect's own" colour was a near-black grey-blue)
const DEFAULT_COLOR = '#87AE73';
const DEFAULT_FADE = 60;
const HEX = /^#[0-9a-fA-F]{6}$/;

function hexOr(value: unknown, fallback: string): string {
    return typeof value === 'string' && HEX.test(value) ? value : fallback;
}

/** `hex` mixed towards black by `amount` (0-1). */
function darken(hex: string, amount: number): string {
    const out = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)));
    return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

class ColourEffectInstance implements EffectInstance<ColourEffectSettings> {
    private total = 200;
    private color = DEFAULT_COLOR;
    private color2: string | null = null;

    initPanorama(ctx: PanoramaInitContext<ColourEffectSettings>): void {
        this.total = Math.max(1, ctx.width);
        this.apply(ctx.settings);
    }

    onSettingsChange(settings: ColourEffectSettings): void {
        this.apply(settings);
    }

    tickPanorama(): void {}

    renderSlice(offsetX: number, width: number, height: number): string {
        if (!this.color2) return `<rect width="${width}" height="${height}" fill="${this.color}"/>`;
        // The gradient runs over the whole row: this slice sees the part from -offsetX to total - offsetX.
        const id = `kcg${Math.round(offsetX)}`;
        return (
            `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${-offsetX}" y1="0" x2="${this.total - offsetX}" y2="0">` +
            `<stop offset="0" stop-color="${this.color}"/><stop offset="1" stop-color="${this.color2}"/></linearGradient></defs>` +
            `<rect width="${width}" height="${height}" fill="url(#${id})"/>`
        );
    }

    private apply(settings: ColourEffectSettings): void {
        this.color = hexOr(settings.color, DEFAULT_COLOR);
        const amount = Math.max(0, Math.min(100, Number(settings.fadeAmount ?? DEFAULT_FADE))) / 100;
        this.color2 = settings.fade && amount > 0 ? darken(this.color, amount) : null;
    }
}

const colour: EffectDefinition<ColourEffectSettings> = {
    id: 'colour',
    displayName: 'Colour',
    defaultSettings: { color: DEFAULT_COLOR, fade: false, fadeAmount: DEFAULT_FADE },
    settingsSchema: [
        { key: 'color', type: 'color', label: 'Colour', default: DEFAULT_COLOR },
        { key: 'fade', type: 'checkbox', label: 'Fade across the row', default: false },
        { key: 'fadeAmount', type: 'range', label: 'Fade strength', min: 0, max: 100, step: 5, default: DEFAULT_FADE },
    ],
    // A still colour: no need for 10 frames a second
    preferredTickMs: 1000,
    createInstance: () => new ColourEffectInstance(),
};

export default colour;
