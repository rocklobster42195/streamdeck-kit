// Messages between a plugin and its property inspectors that the kit handles itself (shared by both
// sides, types only). Plugins add their own events next to these.

/** An entry of a list the plugin provides to the PI (see PiBridge.registerOptions and <pi-select>). */
export type OptionItem = {
    value: string;
    label: string;
    /** Second line, e.g. the provider. */
    sub?: string;
    /** MDI path for a preview (e.g. the icon picker). */
    icon?: string;
    /** A small picture before the label (URL or data URI), e.g. an app's icon. */
    image?: string;
};

/** PI → plugin */
export type KitPiRequest =
    /** Sent once the PI is connected; the plugin answers with everything it pushes. */
    | { event: "pi-ready" }
    | { event: "options"; requestId: number; source: string; params?: Record<string, string> };

/** Plugin → PI */
export type KitPiPush =
    | { event: "options-result"; requestId: number; source: string; items: OptionItem[]; error?: string }
    | { event: "preview"; preview: unknown };
