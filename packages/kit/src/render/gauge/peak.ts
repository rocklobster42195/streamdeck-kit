// Meter ballistics: how a shown level follows the measured one.
//  - MeterBallistics (digital meters): jumps up at once, falls at a fixed rate, and holds the peak
//    for a while before it falls too.
//  - VuBallistics (analog VU): a needle with inertia; it takes ~300 ms to reach a new level.

export type MeterState = { level: number; peak: number };

export class MeterBallistics {
    private level = -Infinity;
    private peak = -Infinity;
    private peakAt = 0;
    private last = 0;

    constructor(
        private readonly releaseDbPerS = 20,
        private readonly holdMs = 1500,
        private readonly floorDb = -60,
    ) {}

    /** Feed a measured value (dB) at time `now` (ms); returns what to draw. */
    update(db: number, now: number): MeterState {
        const dt = this.last ? Math.max(0, now - this.last) / 1000 : 0;
        this.last = now;
        const fallen = Math.max(this.floorDb, this.level - this.releaseDbPerS * dt);
        this.level = Math.max(Number.isFinite(db) ? db : this.floorDb, fallen);
        if (this.level >= this.peak || now - this.peakAt > this.holdMs) {
            if (this.level >= this.peak) this.peakAt = now;
            // after the hold time the peak falls like the level does
            this.peak = this.level >= this.peak ? this.level : Math.max(this.level, this.peak - this.releaseDbPerS * dt);
        }
        return { level: this.level, peak: this.peak };
    }

    /** True while something is still moving (for redraw loops). */
    moving(now: number): boolean {
        return this.level > this.floorDb || (this.peak > this.floorDb && now - this.peakAt <= this.holdMs + 5000);
    }
}

export class VuBallistics {
    private vu = -20;
    private last = 0;

    /** `timeMs`: time to reach ~99% of a step (the VU standard is 300 ms). */
    constructor(private readonly timeMs = 300) {}

    /** Feed a level in VU at time `now` (ms); returns the needle position in VU. */
    update(vu: number, now: number): number {
        const dt = this.last ? Math.max(0, now - this.last) : 0;
        this.last = now;
        const target = Number.isFinite(vu) ? vu : -20;
        // first-order lag: 99% after timeMs → time constant timeMs / ln(100)
        const k = 1 - Math.exp(-dt / (this.timeMs / Math.log(100)));
        this.vu += (target - this.vu) * (dt ? k : 1);
        return this.vu;
    }
}
