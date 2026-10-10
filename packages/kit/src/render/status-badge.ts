// A player's status in the corner of a key or a dial (grill 2026-10-10): "loading" (a command is
// being carried out and takes a while: Music Assistant starting a Spotify playlist) and "failed" (it
// was refused or ran into an error, for a few seconds). Bottom left, where nothing else sits.
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

/** The badge on a 144 px key, bottom left. */
export function keyStatusBadge(kind: StatusKind): string {
    return statusBadge(kind, 10, 112, 22);
}
