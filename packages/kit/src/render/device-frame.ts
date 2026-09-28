// A drawn Stream Deck housing for screenshots, READMEs and store pictures: a dark body with a
// screen well and, for the Stream Deck +, the row of knobs. Pure SVG; put the picture of the keys
// and touch strip at (screenX, screenY) on top (e.g. with sharp's composite).

export type DeviceFrameOptions = {
    /** Size of the picture that goes into the screen well. */
    screenWidth: number;
    screenHeight: number;
    /** Knobs under the screen (Stream Deck +: 4; + XL: 6; 0 for a keys-only deck). */
    knobs?: number;
    /** Distance between knob centres and the first centre's offset from the screen's left edge (SD+: 200 and 112). */
    knobSpacing?: number;
    knobOffset?: number;
    /** Border around the screen. */
    padding?: number;
};

export type DeviceFrame = { svg: string; width: number; height: number; screenX: number; screenY: number };

export function deviceFrame(o: DeviceFrameOptions): DeviceFrame {
    const pad = o.padding ?? 36;
    const knobs = o.knobs ?? 0;
    const knobRow = knobs ? 120 : 0;
    const width = o.screenWidth + 2 * pad;
    const height = o.screenHeight + 2 * pad + knobRow;
    const cy = height - pad - knobRow / 2 + 4;
    const spacing = o.knobSpacing ?? 200;
    const offset = o.knobOffset ?? 112;
    const knob = (cx: number) =>
        `<circle cx="${cx}" cy="${cy}" r="40" fill="url(#df-knob)"/><circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="30" fill="url(#df-top)"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>
<linearGradient id="df-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2b2f"/><stop offset="1" stop-color="#131316"/></linearGradient>
<radialGradient id="df-knob" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#4a4b50"/><stop offset="1" stop-color="#16171a"/></radialGradient>
<radialGradient id="df-top" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#34353a"/><stop offset="1" stop-color="#1b1c1f"/></radialGradient></defs>
<rect width="${width}" height="${height}" rx="34" fill="url(#df-body)"/>
<rect x="${pad - 10}" y="${pad - 10}" width="${o.screenWidth + 20}" height="${o.screenHeight + 20}" rx="18" fill="#08080a"/>
${Array.from({ length: knobs }, (_, i) => knob(pad + offset + i * spacing)).join("")}</svg>`;
    return { svg, width, height, screenX: pad, screenY: pad };
}
