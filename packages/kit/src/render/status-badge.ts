// A player's status on a key or a dial (grill 2026-10-10): "loading" (a command is being carried
// out and takes a while: Music Assistant starting a Spotify playlist) is an hourglass in the middle,
// one symbol size, straight on the dimmed key; "failed" (refused, or ran into an error, for a few
// seconds) a small badge: on a key top left (not where the marker sits, nor the caption), on a dial bottom left. "Offline" uses the same
// spot and look (an error is always in the same place).
import { mdiAlertCircle, mdiCloudOffOutline, mdiTimerSand } from '@mdi/js';

/** The hourglass: its path fills 20 of 24 units (a play symbol only 14), so it is drawn smaller to look as large as the key's other symbols. */
export const HOURGLASS = { size: 68, x: 38, y: 38 } as const;
const HOURGLASS_TRANSFORM = `translate(${HOURGLASS.x} ${HOURGLASS.y}) scale(${(HOURGLASS.size / 24).toFixed(4)})`;

export type StatusKind = 'loading' | 'failed';

const COLORS: Record<StatusKind, string> = { loading: '#e0e0e0', failed: '#ff6b6b' };
const ICONS: Record<StatusKind, string> = { loading: mdiTimerSand, failed: mdiAlertCircle };

/** A small badge with its icon, top-left at (x, y), `size` px. */
export function statusBadge(kind: StatusKind, x: number, y: number, size = 16): string {
    return badge(ICONS[kind], COLORS[kind], x, y, size);
}

/** The same badge with the "offline" cloud: an error is always shown in the same spot, in the same look. */
export function offlineBadge(x: number, y: number, size = 16): string {
    return badge(mdiCloudOffOutline, COLORS.failed, x, y, size);
}

function badge(path: string, color: string, x: number, y: number, size: number): string {
    const r = size / 2 + 3;
    const scale = size / 24;
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${r}" fill="#000" opacity="0.7"/><path transform="translate(${x} ${y}) scale(${scale})" fill="${color}" d="${path}"/>`;
}

/** A key while a command takes a while: dimmed, the hourglass straight on it in the middle (sized to look like the other symbols, no disc). */
export function keyLoadingOverlay(): string {
    return `<rect width="144" height="144" fill="#000" opacity="0.55"/><path transform="${HOURGLASS_TRANSFORM}" fill="#e0e0e0" d="${mdiTimerSand}"/>`;
}

/** A plain key while a command takes a while: the hourglass replaces its symbol (sized to look like the other symbols). */
export function keyLoadingGlyph(): string {
    return `<path transform="${HOURGLASS_TRANSFORM}" fill="#e0e0e0" d="${mdiTimerSand}"/>`;
}

/** The badge on a 144 px key, top left (an error is always in the same place). */
export function keyStatusBadge(kind: StatusKind): string {
    return statusBadge(kind, 10, 10, 22);
}

/** "Offline" on a 144 px key: the same spot and look as a failed command (top left). */
export function keyOfflineBadge(): string {
    return offlineBadge(10, 10, 22);
}

/** "Offline" on a 200 × 100 dial strip: bottom left, where the dials show a failed command. */
export function dialOfflineBadge(): string {
    return offlineBadge(4, 80);
}
