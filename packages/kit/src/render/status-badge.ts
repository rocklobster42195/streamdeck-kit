// A player's status on a key or a dial (grill 2026-10-10): "loading" (a command is being carried
// out and takes a while: Music Assistant starting a Spotify playlist) is an hourglass in the middle,
// one symbol size, straight on the dimmed key; "failed" (refused, or ran into an error, for a few
// seconds) a small badge at the bottom left, where nothing else sits.
import { mdiAlertCircle, mdiTimerSand } from '@mdi/js';

/** The hourglass: its path fills 20 of 24 units (a play symbol only 14), so it is drawn smaller to look as large as the key's other symbols. */
export const HOURGLASS = { size: 52, x: 46, y: 46 } as const;
const HOURGLASS_TRANSFORM = `translate(${HOURGLASS.x} ${HOURGLASS.y}) scale(${(HOURGLASS.size / 24).toFixed(4)})`;

export type StatusKind = 'loading' | 'failed';

const COLORS: Record<StatusKind, string> = { loading: '#e0e0e0', failed: '#ff6b6b' };
const ICONS: Record<StatusKind, string> = { loading: mdiTimerSand, failed: mdiAlertCircle };

/** A small badge with its icon, top-left at (x, y), `size` px. */
export function statusBadge(kind: StatusKind, x: number, y: number, size = 16): string {
    const r = size / 2 + 3;
    const scale = size / 24;
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${r}" fill="#000" opacity="0.7"/><path transform="translate(${x} ${y}) scale(${scale})" fill="${COLORS[kind]}" d="${ICONS[kind]}"/>`;
}

/** A key while a command takes a while: dimmed, the hourglass straight on it in the middle (sized to look like the other symbols, no disc). */
export function keyLoadingOverlay(): string {
    return `<rect width="144" height="144" fill="#000" opacity="0.55"/><path transform="${HOURGLASS_TRANSFORM}" fill="#e0e0e0" d="${mdiTimerSand}"/>`;
}

/** A plain key while a command takes a while: the hourglass replaces its symbol (sized to look like the other symbols). */
export function keyLoadingGlyph(): string {
    return `<path transform="${HOURGLASS_TRANSFORM}" fill="#e0e0e0" d="${mdiTimerSand}"/>`;
}

/** The badge on a 144 px key, bottom left. */
export function keyStatusBadge(kind: StatusKind): string {
    return statusBadge(kind, 10, 112, 22);
}
