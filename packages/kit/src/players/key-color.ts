// A key's colour (grill 2026-10-04): the icon of an "on" or ready key takes this colour, "off" and
// "not available" stay grey. A choice is "grey" (today's look, the default), "cover" (the colour of
// the key's player), "row" (like the Panorama: the row colour of the key's Stream Deck) or a fixed
// "#RRGGBB".

export const KEY_GREY = '#CCCCCC';
export type KeyColorChoice = 'grey' | 'cover' | 'row' | `#${string}`;

export const KEY_COLOR_CHOICES = ['grey', 'cover', 'row'] as const;

/**
 * The icon colour for a choice. `cover`: the key's player's colour (kept while paused by the
 * plugin that publishes it; none when nothing is loaded). `row`: the Panorama row's colour, already
 * resolved. Without a colour: grey.
 */
export function resolveKeyColor(choice: string | undefined, from: { cover?: string; row?: string } = {}): string {
    if (choice && /^#[0-9a-f]{6}$/i.test(choice)) return choice;
    if (choice === 'cover') return from.cover ?? KEY_GREY;
    if (choice === 'row') return from.row ?? KEY_GREY;
    return KEY_GREY;
}
