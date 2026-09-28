import { AnimatedValue } from "./animation.js";
import { frames } from "./frames.js";

const values = new Map<string, AnimatedValue>();

/**
 * The value to draw for `key` while it glides toward `target` (e.g. a volume ring). The first
 * call jumps straight to the target; later changes ease over `durationMs`, and `redraw` is called
 * on every frame until the value has arrived.
 */
export function glide(key: string, target: number, redraw: () => void, durationMs = 220): number {
    let v = values.get(key);
    if (!v) {
        v = new AnimatedValue(target, durationMs);
        values.set(key, v);
        return target;
    }
    v.set(target);
    if (v.animating) {
        const anim = v;
        frames.run(`glide-${key}`, () => {
            redraw();
            return anim.animating;
        });
    }
    return v.value();
}

/** Forget a key (e.g. when its dial disappears). */
export function forgetGlide(key: string): void {
    values.delete(key);
    frames.stop(`glide-${key}`);
}
