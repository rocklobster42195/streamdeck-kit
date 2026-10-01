// The family's own key feedback instead of Stream Deck's generic showOk()/showAlert(): a disc in
// the key's colour grows from the centre and a white check mark draws itself in it ("ok"), or an
// exclamation mark on red ("alert"); then the key's own image comes back. About 0.7 s, drawn as
// SVG frames at the key's @2x size.
import { escapeXml } from "./strip.js";

export type FeedbackKind = "ok" | "alert";

export type FeedbackOptions = {
    /** The disc's colour; default: Yellow Sea for "ok", Monza for "alert" (the standard colours). */
    color?: string;
    /** The key's background. */
    background?: string;
    /** Image size; default the key's 144 × 144. A dial's touch strip is 200 × 100 (drawn centred). */
    width?: number;
    height?: number;
};

/** The defaults, from the kit's standard colours. */
export const FEEDBACK_COLORS: Record<FeedbackKind, string> = { ok: "#F7A600", alert: "#E30018" };

const SIZE = 144;
const DURATION_MS = 700;
const FRAME_MS = 40;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** One frame of the feedback, `p` from 0 (start) to 1 (end), as an SVG data URI. */
export function feedbackFrame(kind: FeedbackKind, p: number, opts: FeedbackOptions = {}): string {
    const color = escapeXml(opts.color || FEEDBACK_COLORS[kind]);
    const bg = escapeXml(opts.background ?? "#111111");
    const c = SIZE / 2;
    // The disc grows (0–0.35), a ring pulses outwards (0.25–0.7), everything fades at the end (0.85–1)
    const r = 52 * easeOut(clamp(p / 0.35));
    const ring = clamp((p - 0.25) / 0.45);
    const fade = 1 - clamp((p - 0.85) / 0.15);
    const draw = clamp((p - 0.25) / 0.35);
    const w = opts.width ?? SIZE;
    const h = opts.height ?? SIZE;
    // Drawn for 144 × 144 and scaled into the middle of the image (a strip: the 100 px height)
    const scale = Math.min(w, h) / SIZE;
    const tx = (w - SIZE * scale) / 2;
    const ty = (h - SIZE * scale) / 2;
    const parts = [`<rect width="${w}" height="${h}" fill="${bg}"/>`, `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale.toFixed(4)})"><g opacity="${fade.toFixed(3)}">`];
    if (ring > 0 && ring < 1) parts.push(`<circle cx="${c}" cy="${c}" r="${(52 + ring * 16).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(6 * (1 - ring)).toFixed(2)}" opacity="${(0.6 * (1 - ring)).toFixed(3)}"/>`);
    parts.push(`<circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="${color}"/>`);
    if (kind === "ok") {
        // The check mark draws itself from left to right
        const length = 90;
        parts.push(`<polyline points="46,74 64,92 100,56" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${length}" stroke-dashoffset="${(length * (1 - draw)).toFixed(1)}"/>`);
    } else {
        // The exclamation mark grows downwards, then its dot appears
        const bar = clamp(draw / 0.7);
        if (bar > 0) parts.push(`<line x1="${c}" y1="44" x2="${c}" y2="${(44 + 38 * bar).toFixed(1)}" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>`);
        if (draw > 0.75) parts.push(`<circle cx="${c}" cy="101" r="7" fill="#ffffff"/>`);
    }
    parts.push("</g></g>");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

type Target = { setImage(image?: string): Promise<unknown> | unknown };

const playing = new Map<string, ReturnType<typeof setInterval>>();

/** Whether feedback is playing on this key (draw nothing over it meanwhile). */
export function isFeedbackPlaying(id: string): boolean {
    return playing.has(id);
}

/**
 * Play the feedback on a key: frames for about 0.7 s, then `restore()` (redraw the key's own image).
 * A new feedback on the same key replaces a running one.
 */
export function playFeedback(id: string, target: Target, kind: FeedbackKind, opts: FeedbackOptions & { restore: () => void }): void {
    clearInterval(playing.get(id));
    const start = Date.now();
    const step = () => {
        const p = (Date.now() - start) / DURATION_MS;
        if (p >= 1) {
            clearInterval(playing.get(id));
            playing.delete(id);
            opts.restore();
            return;
        }
        void Promise.resolve(target.setImage(feedbackFrame(kind, p, opts))).catch(() => {});
    };
    playing.set(id, setInterval(step, FRAME_MS));
    step();
}
