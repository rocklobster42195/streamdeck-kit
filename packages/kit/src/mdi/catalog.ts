import * as mdi from "@mdi/js";

// All Material Design Icons by name ("mdiPasta" → path), for keys whose icon the user picks in the
// PI. Importing the whole set adds ~3 MB to the plugin; only this module does it.
const PATHS = mdi as unknown as Record<string, string>;
const NAMES = Object.keys(PATHS).filter((n) => n.startsWith("mdi") && typeof PATHS[n] === "string");

/** Human-readable name of an icon ("mdiSilverwareForkKnife" → "silverware fork knife"). */
export function mdiLabel(name: string): string {
    return words(name);
}

/** The words the search matches against (same as the label). */
function words(name: string): string {
    return name
        .slice(3)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Za-z])([0-9])/g, "$1 $2")
        .toLowerCase();
}

const INDEX = NAMES.map((name) => ({ name, words: words(name) }));

/** The path of an icon name, or undefined if there is no such icon. */
export function mdiPath(name: string | undefined): string | undefined {
    return name && name.startsWith("mdi") ? PATHS[name] : undefined;
}

/** Up to `limit` icons matching all words of `query`: whole-word hits first, then prefixes, then the rest. */
export function searchMdi(query: string, limit = 48): { name: string; label: string; path: string }[] {
    const terms = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (!terms.length) return [];
    const rank = (w: string) => {
        const list = w.split(" ");
        let score = 0;
        for (const t of terms) {
            if (list.includes(t)) score += 0;
            else if (list.some((x) => x.startsWith(t))) score += 1;
            else if (w.includes(t)) score += 2;
            else return -1;
        }
        return score * 100 + w.length;
    };
    return INDEX.map((e) => ({ e, r: rank(e.words) }))
        .filter((x) => x.r >= 0)
        .sort((a, b) => a.r - b.r)
        .slice(0, limit)
        .map(({ e }) => ({ name: e.name, label: e.words, path: PATHS[e.name] }));
}

/**
 * Options source for <pi-icon-picker>: register it with piBridge.registerOptions("mdi-icons",
 * mdiOptions). An exact "mdi…" name returns just that icon (the picker looks up its current choice).
 */
export function mdiOptions({ q }: Record<string, string>): { value: string; label: string; icon: string }[] {
    const exact = mdiPath(q);
    if (exact) return [{ value: q, label: mdiLabel(q), icon: exact }];
    return searchMdi(q ?? "").map((r) => ({ value: r.name, label: r.label, icon: r.path }));
}
