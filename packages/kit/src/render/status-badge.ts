// A player's status on a key or a dial (grill 2026-10-10): "loading" (a command is being carried
// out and takes a while: Music Assistant starting a Spotify playlist) is an hourglass in the middle,
// the size of the play symbol of a paused key; "failed" (refused, or ran into an error, for a few
// seconds) a small badge at the bottom left, where nothing else sits.
import { mdiAlertCircle, mdiTimerSand } from '@mdi/js';

export type StatusKind = 'loading' | 'failed';

const COLORS: Record<StatusKind, string> = { loading: '#e0e0e0', failed: '#ff6b6b' };
const ICONS: Record<StatusKind, string> = { loading: mdiTimerSand, failed: mdiAlertCircle };

/** A small badge with its icon, top-left at (x, y), `size` px. */
export function statusBadge(kind: StatusKind, x: number, y: number, size = 16): string {
    const r = size / 2 + 3;
    const scale = size / 24;
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${r}" fill="#000" opacity="0.7"/><path transform="translate(${x} ${y}) scale(${scale})" fill="${COLORS[kind]}" d="${ICONS[kind]}"/>`;
}

/** A key while a command takes a while: dimmed, the hourglass in the middle (as the paused play symbol). */
export function keyLoadingOverlay(): string {
    return `<rect width="144" height="144" fill="#000" opacity="0.55"/><circle cx="72" cy="72" r="30" fill="#000" opacity="0.55"/><path transform="translate(48 48) scale(2)" fill="#e0e0e0" d="${mdiTimerSand}"/>`;
}

/** The badge on a 144 px key, bottom left. */
export function keyStatusBadge(kind: StatusKind): string {
    return statusBadge(kind, 10, 112, 22);
}
