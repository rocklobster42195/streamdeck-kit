// The kit's own texts ("kit.*"). t() falls back to these when the plugin's locale files don't have
// the key, so a plugin can override any of them.
type Dict = { [key: string]: string | Dict };

export const KIT_LOCALES: Record<string, Dict> = {
    en: {
        kit: {
            choose: "Choose",
            loading: "Loading…",
            no_options: "Nothing available.",
            show_token: "Show token",
            icon_default: "Default",
            icon_default_name: "Default icon",
            icon_search: "Search icons … (e.g. pasta, bell, coffee)",
            icon_none_found: "No icon found.",
            threshold_base: "Colour",
            threshold_from: "From",
            threshold_add: "Add a colour range",
            threshold_remove: "Remove",
            color_pick: "Pick a colour",
            color_auto: "Automatic",
            color_standard: "Standard colours",
            color_recent: "Recent",
            color_brightness: "Brightness",
        },
    },
    de: {
        kit: {
            choose: "Wählen",
            loading: "Lädt…",
            no_options: "Nichts verfügbar.",
            show_token: "Token anzeigen",
            icon_default: "Standard",
            icon_default_name: "Standardsymbol",
            icon_search: "Symbol suchen … (z. B. pasta, bell, coffee)",
            icon_none_found: "Kein Symbol gefunden.",
            threshold_base: "Farbe",
            threshold_from: "Ab",
            threshold_add: "Farbbereich hinzufügen",
            threshold_remove: "Entfernen",
            color_pick: "Farbe wählen",
            color_auto: "Automatisch",
            color_standard: "Standardfarben",
            color_recent: "Zuletzt",
            color_brightness: "Helligkeit",
        },
    },
};
