// The old per-dial "background" setting, before one effect per row (rows.ts): unset or "auto" took
// the neighbour's effect, "none" showed none, anything else was an effect id. Only read now, to take
// old settings over (see rowStateFromSettings).

export const BACKGROUND_AUTO = 'auto';
export const BACKGROUND_NONE = 'none';
