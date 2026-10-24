// Ported from sonos-controller (src/effects/types.ts). Keep both in sync — see the sync rule in CLAUDE.md.
// Shared contract for Panorama Effects. See CONTRIBUTING_EFFECTS.md for the full guide.
//
// `id`, `displayName`, `defaultSettings`, and `settingsSchema` on EffectDefinition MUST be
// plain object/array/string/number/boolean literals — the codegen script
// (tools/generate-effects-registry.mjs) reads them straight off the source AST, without
// executing the module, to build the Property Inspector's manifest. Only `createInstance`
// may contain arbitrary logic/imports.

export type EffectField =
    /** `control`: the getControls() id this value belongs to (hosts show the same icon in the PI). */
    | { key: string; type: 'range'; label: string; min: number; max: number; step?: number; default: number; control?: string }
    | { key: string; type: 'color'; label: string; default: string }
    | { key: string; type: 'checkbox'; label: string; default: boolean }
    | { key: string; type: 'select'; label: string; options: { label: string; value: string }[]; default: string }
    /** A picture to show: a file picked in the PI (stored by the kit, see PanoramaSource) or, later, a web address. */
    | { key: string; type: 'source'; label: string; default: unknown };

export interface PanoramaInitContext<S> {
    /** Total panorama width in px = number of displays currently in the group x 200. */
    width: number;
    /** Always 100. */
    height: number;
    settings: S;
}

export interface EffectInstance<S = Record<string, unknown>> {
    /** Called on group formation AND every time group membership changes (a display joins or
     *  leaves). `width` reflects the CURRENT panorama size — never cache it beyond one call. */
    initPanorama(ctx: PanoramaInitContext<S>): void;
    /** Called once per tick PER GROUP (not per display). Do all physics/state advancement here —
     *  never in renderSlice, see CONTRIBUTING_EFFECTS.md's Dos and Don'ts. */
    tickPanorama(dtMs: number): void;
    /** Called once per tick PER DISPLAY. Must only project/draw the state tickPanorama already
     *  computed. Returns an SVG fragment (no outer <svg> tag). */
    renderSlice(offsetX: number, width: number, height: number): string;

    /** Optional: the tick interval this instance wants right now, in ms (read after every tick; the
     *  effect's `preferredTickMs` is used until then). Do not go slower than the default (100 ms):
     *  see `preferredTickMs`. */
    tickMs?(): number | undefined;

    /** Called when the host's PI-managed settings change (e.g. a device's dominant color). */
    onSettingsChange?(settings: S): void;
    destroy?(): void;

    /** Optional interaction hooks. Only ever invoked when this effect runs on the Panorama
     *  Effects action itself — Track/Volume/Group Volume dials keep rotate/press/touch bound to
     *  their own primary function and never forward them to the effect. */
    onRotate?(ticks: number): void;
    onPress?(): void;
    onTouch?(x: number, y: number): void;

    /** Optional: what rotating can change ("count", "speed", "density", …), in the order a host
     *  cycles through them; getControl/setControl read and switch the one rotating changes now. */
    getControls?(): string[];
    getControl?(): string;
    setControl?(id: string): void;

    /** Optional: the audio level 0..1 of the group's audio source (e.g. mixer meters over deckbus),
     *  called before every tickPanorama; `undefined` = no audio source, behave as usual. Effects
     *  can move with the music (speed, pulse, density). */
    setLevel?(level: number | undefined): void;
    /** Optional 0-100 value shown on the dial's ring indicator. */
    getIndicatorValue?(): number;
    /** Optional: return the subset of settings this effect wants persisted after onRotate/onPress
     *  changed its internal state (e.g. a live-tunable density/speed). Read before saving. */
    getRuntimeSettings?(): Partial<S>;
}

export interface EffectDefinition<S = Record<string, unknown>> {
    /** Stable id, stored in user settings. Never change this once released — renaming it resets
     *  every user's saved settings for this effect. */
    id: string;
    /** Shown in the effect picker dropdown in the Property Inspector. */
    displayName: string;
    /** Not offered in effect pickers (e.g. the blank effect hosts use for "no effect"). */
    hidden?: boolean;
    /** false: the effect does not use the row's colour (e.g. a picture), so hosts leave the colour choice out. Default: true. */
    rowColor?: boolean;
    defaultSettings: S;
    /** Drives auto-generated PI controls. Field labels/keys are entirely up to you. */
    settingsSchema: EffectField[];
    /** Group tick interval in ms this effect wants (defaults to the host's own default — currently
     *  100ms/10fps — when omitted). Faster/larger-amplitude motion (e.g. Boing Ball's bounce) reads
     *  as visibly choppy at the default rate; slow ambient drift (Particles) does not need more.
     *  Confirmed on hardware (2026-07-18): Boing Ball at 10fps was noticeably stuttery.
     *
     *  Never slower than the default, even for a picture that hardly moves: the dials of a row are
     *  redrawn on the group's tick (a plugin whose dial has a Panorama behind it redraws on the slice that
     *  arrives with the tick), so a slow tick makes a level meter or a progress bar on such a dial
     *  sluggish (seen 2026-10-24: Colour and Image at 1 tick a second made the mixer meters crawl). */
    preferredTickMs?: number;
    createInstance(): EffectInstance<S>;
}
