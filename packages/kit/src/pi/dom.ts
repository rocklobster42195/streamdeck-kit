// Tiny DOM helpers for the PI components (no framework — light DOM, so the theme styles everything).

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

/** Stroke icons (24×24 viewBox) used across the PI. */
export const PI_ICONS = {
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    target: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/>',
    speaker: '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="14" r="3"/><circle cx="12" cy="7" r="1"/>',
    plug: '<path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0z M12 16v5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    play: '<path d="M8 5v14l11-7z"/>',
};

export function icon(name: keyof typeof PI_ICONS, size = 16, cls = ''): string {
    return `<svg class="pi-icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PI_ICONS[name]}</svg>`;
}
