// Colour helpers of the two Boing effects (ball and globe): the colour glides to a new target like
// Particles and Matrix Rain do (a new cover's colour no longer cuts in), and a colour that would
// vanish against its partner is pushed away from it (a pale cover on the white checker, a blue
// cover on the blue ocean).
export type Rgb = [number, number, number];

export function hexToRgb01(hex: string): Rgb {
    const h = hex.replace('#', '');
    return [parseInt(h.substring(0, 2), 16) / 255, parseInt(h.substring(2, 4), 16) / 255, parseInt(h.substring(4, 6), 16) / 255];
}

/** Relative brightness 0..1 (the same weights as the key colour code). */
export function luminance(c: Rgb): number {
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

/**
 * `color`, moved away from `ref` in brightness until they differ by at least `minDiff`: lighter
 * when it was lighter (darker when there is no room above), the hue kept.
 */
export function separate(color: Rgb, ref: Rgb, minDiff: number): Rgb {
    const l = luminance(color);
    const lr = luminance(ref);
    if (Math.abs(l - lr) >= minDiff) return color;
    let target = l >= lr ? lr + minDiff : lr - minDiff;
    if (target > 1 || target < 0) target = l >= lr ? lr - minDiff : lr + minDiff;
    target = Math.min(1, Math.max(0, target));
    if (target > l) {
        const f = (target - l) / (1 - l || 1);
        return [color[0] + (1 - color[0]) * f, color[1] + (1 - color[1]) * f, color[2] + (1 - color[2]) * f];
    }
    const f = l ? target / l : 0;
    return [color[0] * f, color[1] * f, color[2] * f];
}

/** One step of `current` towards `target` (a share of the way per tick; snaps when close). */
export function glide(current: Rgb, target: Rgb, share = 0.18): Rgb {
    const next: Rgb = [0, 0, 0];
    let close = true;
    for (let i = 0; i < 3; i++) {
        const d = target[i] - current[i];
        next[i] = Math.abs(d) < 0.004 ? target[i] : current[i] + d * share;
        if (next[i] !== target[i]) close = false;
    }
    return close ? [...target] : next;
}

export function sameColor(a: Rgb, b: Rgb): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
