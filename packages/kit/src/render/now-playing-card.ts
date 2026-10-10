// A dial's idle card (from MA-C's Browser dial): the cover on the left, and on the right what is
// playing — either the source it was started from (kind, name, current track) or title and artist —
// with a hint underneath (e.g. "Turn to browse"). Optionally over a Panorama backdrop.
import { mdiFolderMusic } from '@mdi/js';
import { image, mdi, stripImage, text, wrap } from './strip.js';

/** Where the music comes from (a playlist, an album, a favourite) and the current track. */
export type NowPlayingSource = { kind: string; name: string; track: string };

export type NowPlayingCard = {
    cover?: string;
    /** MDI path shown when there is no cover (default: a music folder). */
    placeholderIcon?: string;
    title: string;
    artist?: string;
    /** Shown instead of title/artist (unless a flash is on). */
    source?: NowPlayingSource;
    /** A short message in place of the title (e.g. "▶ Jazz Radio"). */
    flash?: { text: string; color: string };
    hint: string;
    /** Instead of the hint's words: a row of small icons (MDI paths), e.g. rotate, tap, push. */
    hintIcons?: string[];
    /** Panorama slice (with its darkening) drawn under the card. */
    backdrop?: string;
};

const HINT_ICON = 14;
const HINT_GAP = 12;

/** The hint under the text: its words, or a row of icons when the card has them. */
function hintParts(o: NowPlayingCard, baseline: number): string[] {
    if (!o.hintIcons?.length) return [text(82, baseline, o.hint, { size: 10, color: '#8a8a90', maxWidth: 112 })];
    return o.hintIcons.map((path, i) => mdi(path, 82 + i * (HINT_ICON + HINT_GAP), baseline - 11, HINT_ICON, '#8a8a90'));
}

export function nowPlayingCard(o: NowPlayingCard): string {
    const parts: string[] = [];
    if (o.cover) parts.push(image(o.cover, 8, 18, 64, 64));
    else parts.push(`<rect x="8" y="18" width="64" height="64" rx="6" fill="#1d1d20"/>`, mdi(o.placeholderIcon ?? mdiFolderMusic, 20, 30, 40, '#6c6c72'));
    if (o.source && !o.flash) {
        parts.push(text(82, 26, o.source.kind, { size: 10, color: '#8a8a90', maxWidth: 112 }));
        parts.push(text(82, 44, o.source.name, { size: 13, weight: 'bold', maxWidth: 112 }));
        parts.push(text(82, 62, o.source.track, { size: 11, color: '#c8c8cc', maxWidth: 112 }));
        parts.push(...hintParts(o, 82));
        return stripImage(parts, undefined, o.backdrop);
    }
    // Title (up to two lines, one when there is an artist below), artist, then the hint
    const artist = o.flash ? undefined : o.artist;
    const lines = wrap(o.flash?.text ?? o.title, 112, 13, artist ? 1 : 2);
    lines.forEach((line, i) => parts.push(text(82, 36 + i * 16, line, { size: 13, weight: 'bold', color: o.flash?.color ?? '#ffffff' })));
    if (artist) parts.push(text(82, 55, artist, { size: 11, color: '#c8c8cc', maxWidth: 112 }));
    parts.push(...hintParts(o, 80));
    return stripImage(parts, undefined, o.backdrop);
}
