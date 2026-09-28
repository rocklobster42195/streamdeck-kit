// Pure step planning for volume fades (0..100). Every step is one volume command to the device, so
// the step rate is limited: pass a larger minimum interval for slow paths (e.g. through a server).

export type FadeStep = {
    /** Absolute volume to set at this step. */
    volume: number;
    /** Delay before applying this step, in ms. */
    delayMs: number;
};

const MIN_STEP_INTERVAL_MS = 250;

/**
 * Plans an even volume ramp from `from` to `to` over `durationMs`.
 * The last step always lands exactly on `to`. Returns [] when there is nothing to do.
 */
export function computeFadeSteps(from: number, to: number, durationMs: number, minStepIntervalMs = MIN_STEP_INTERVAL_MS): FadeStep[] {
    from = clampVolume(from);
    to = clampVolume(to);
    if (from === to || durationMs <= 0) return [];

    const distance = Math.abs(to - from);
    const stepCount = Math.max(1, Math.min(distance, Math.floor(durationMs / minStepIntervalMs)));
    const delayMs = durationMs / stepCount;

    const steps: FadeStep[] = [];
    let previous = from;
    for (let i = 1; i <= stepCount; i++) {
        const volume = Math.round(from + ((to - from) * i) / stepCount);
        if (volume === previous) continue; // skip no-op volume commands on coarse ramps
        steps.push({ volume, delayMs });
        previous = volume;
    }
    return steps;
}

function clampVolume(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
}
