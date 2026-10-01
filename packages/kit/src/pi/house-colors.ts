// The colours the colour picker offers first: the family's house palette, and the colours the user
// picked last (kept in the PI's localStorage, so they are shared by every key of the plugin).

export type NamedColor = { name: string; hex: string };

/** The house palette (CD Düsseldorf; Endeavour is the family's logo colour). */
export const HOUSE_COLORS: readonly NamedColor[] = [
    { name: 'Düsseldorf Rot', hex: '#E30018' },
    { name: 'Düsseldorf Blau', hex: '#009FDF' },
    { name: 'Endeavour', hex: '#005DA0' },
    { name: 'Persian Green', hex: '#00ACA8' },
    { name: 'Vida Loca', hex: '#59A028' },
    { name: 'Rio Grande', hex: '#AFCA05' },
    { name: 'School Bus Yellow', hex: '#FFDD00' },
    { name: 'Yellow Sea', hex: '#F7A600' },
    { name: 'Cerise', hex: '#E14190' },
    { name: 'Plum', hex: '#993386' },
    { name: 'Weiß', hex: '#FFFFFF' },
    { name: 'Grau', hex: '#A5A5A5' },
    { name: 'Schwarz', hex: '#000000' },
];

const RECENT_KEY = 'pi-kit.recent-colors';
const RECENT_MAX = 8;

export function recentColors(): string[] {
    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
        return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string').slice(0, RECENT_MAX) : [];
    } catch {
        return [];
    }
}

/** Put a colour first in the recent list (house colours aren't repeated there). */
export function rememberColor(hex: string): void {
    if (HOUSE_COLORS.some((c) => c.hex === hex)) return;
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...recentColors().filter((c) => c !== hex)].slice(0, RECENT_MAX)));
    } catch {
        // No storage (private window): the picker works without the recent list
    }
}
