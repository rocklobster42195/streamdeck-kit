// <pi-panorama [summary]>: the Panorama of the dial's row (see the kit's panorama/rows.ts), the
// same in every plugin. In the settings window: the row's effect, a map of the device's dials with
// their plugin, name and checkbox ("in the Panorama"; also other plugins' dials), and the effect's
// settings, once for the row, with the row's colour (the cover of a player on deckbus, fixed, or
// the effect's own; the effects' own colour fields don't show). With `summary` (the short PI): one
// line, opening the window at it.
// Data comes from the plugin ("panorama-row"); changes go back as "panorama-set" / "panorama-member".
import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';
import { openSettingsWindow, showSettingsInline } from '../window.js';

type Field = { key: string; type: 'range' | 'color' | 'checkbox' | 'select'; label: string; min?: number; max?: number; step?: number; default: unknown; options?: { label: string; value: string }[] };
type Info = {
    event: 'panorama-row';
    effect: string;
    settings: Record<string, unknown>;
    effects: { id: string; displayName: string; settingsSchema: Field[] }[];
    dials: { column: number; plugin: string; label: string; member: boolean; self: boolean }[];
    color: string;
    covers: { id: string; label: string; color: string; playing: boolean }[];
    liveColorFrom?: string;
};

const NONE = 'none';
const COVER = 'cover';
const COVER_ALL = 'cover-all';
const DEFAULT = 'default';
const COLOR_KEY = 'rowColor';

/** The colour tile a choice belongs to. */
const colorMode = (c: string) => (c === DEFAULT ? DEFAULT : c.startsWith('#') ? 'fixed' : COVER);

/** Translation with a fallback (effect names and field labels come from the effect in English). */
function tr(key: string, fallback: string): string {
    const v = t(key);
    return v === key ? fallback : v;
}

export class PiPanorama extends HTMLElement {
    private info: Info | undefined;
    private off: (() => void) | undefined;
    private structure = '';

    connectedCallback(): void {
        if (!this.hasAttribute('summary')) {
            this.id ||= 'panorama';
            this.dataset.windowSection ||= 'kit.panorama';
        }
        this.off = sd.onMessage((msg: Info) => {
            if (msg?.event !== 'panorama-row') return;
            this.info = msg;
            this.render();
        });
        this.render();
    }

    disconnectedCallback(): void {
        this.off?.();
    }

    private effectName(id: string): string {
        if (id === NONE) return t('kit.panorama_none');
        const e = this.info?.effects.find((x) => x.id === id);
        return tr(`effect.${id}.name`, e?.displayName ?? id);
    }

    private render(): void {
        const info = this.info;
        if (!info) {
            this.innerHTML = '';
            this.hidden = true;
            return;
        }
        this.hidden = false;
        if (this.hasAttribute('summary')) return this.renderSummary(info);
        // Rebuild only when the structure changed, so a slider being dragged keeps its place
        const structure = JSON.stringify([info.effect, info.dials, info.effects.map((e) => e.id), info.color, info.covers.map((c) => [c.id, c.label]), info.liveColorFrom]);
        if (structure === this.structure) return this.updateValues(info);
        this.structure = structure;
        const effect = info.effects.find((e) => e.id === info.effect);
        const options = [{ id: NONE }, ...info.effects].map((e) => `<button type="button" class="pi-choice-tile" data-effect="${escapeHtml(e.id)}" aria-pressed="${e.id === info.effect}"><span>${escapeHtml(this.effectName(e.id))}</span></button>`);
        const columns = Math.max(4, ...info.dials.map((d) => d.column + 1));
        const cells = Array.from({ length: columns }, (_, column) => {
            const d = info.dials.find((x) => x.column === column);
            if (!d) return `<div class="pi-pano-cell pi-pano-empty"><span class="pi-hint">${escapeHtml(t('kit.panorama_empty'))}</span></div>`;
            return `<label class="pi-pano-cell${d.self ? ' pi-pano-self' : ''}">
                <input type="checkbox" data-column="${column}" ${d.member ? 'checked' : ''} ${info.effect === NONE ? 'disabled' : ''}/>
                <span class="pi-pano-plugin">${escapeHtml(d.plugin)}</span>
                <span class="pi-pano-label">${escapeHtml(d.label || d.plugin)}</span>
            </label>`;
        });
        this.innerHTML = `
            <div class="pi-section-title">${escapeHtml(t('kit.panorama'))}</div>
            <div class="pi-card pi-pano">
                <div class="pi-choice" style="--pi-choice-columns: 3">${options.join('')}</div>
                <div class="pi-pano-map" style="--pi-pano-columns: ${columns}">${cells.join('')}</div>
                <div class="pi-hint pi-padded">${escapeHtml(t('kit.panorama_map_hint'))}</div>
                ${info.effect === NONE ? '' : this.colorHtml(info)}
                <div class="pi-pano-fields">${(effect?.settingsSchema ?? []).filter((f) => f.type !== 'color').map((f) => this.fieldHtml(effect!.id, f, info.settings[f.key] ?? f.default)).join('')}</div>
            </div>
            <div class="pi-hint pi-padded">${escapeHtml(t('kit.panorama_hint'))}</div>`;
        this.querySelectorAll<HTMLElement>('[data-effect]').forEach((el) => el.addEventListener('click', () => sd.sendToPlugin({ event: 'panorama-set', effect: el.dataset.effect })));
        this.querySelectorAll<HTMLInputElement>('.pi-pano-map input').forEach((el) => el.addEventListener('change', () => sd.sendToPlugin({ event: 'panorama-member', column: Number(el.dataset.column), member: el.checked })));
        this.wireFields();
        this.wireColor(info);
    }

    /** The row's colour: Cover (with the player), fixed, or the effect's own. */
    private colorHtml(info: Info): string {
        const mode = colorMode(info.color);
        const tiles = [
            [COVER, t('kit.panorama_color_cover')],
            ['fixed', t('kit.panorama_color_fixed')],
            [DEFAULT, t('kit.panorama_color_default')],
        ].map(([m, label]) => `<button type="button" class="pi-choice-tile" data-color-mode="${m}" aria-pressed="${m === mode}"><span>${escapeHtml(label)}</span></button>`);
        let detail = '';
        if (mode === COVER) {
            const options = [`<option value="${COVER}">${escapeHtml(t('kit.panorama_color_active'))}</option>`, `<option value="${COVER_ALL}" ${info.color === COVER_ALL ? 'selected' : ''}>${escapeHtml(t('kit.panorama_color_active_all'))}</option>`, ...info.covers.map((c) => `<option value="${COVER}:${escapeHtml(c.id)}" ${info.color === `${COVER}:${c.id}` ? 'selected' : ''}>${c.playing ? '▶ ' : ''}${escapeHtml(c.label)}</option>`)];
            detail = `<select class="pi-input" data-color-player>${options.join('')}</select>`;
            if (!info.covers.length) detail += `<div class="pi-hint">${escapeHtml(t('kit.panorama_color_none'))}</div>`;
        } else if (mode === 'fixed') detail = `<pi-swatch data-color-fixed value="${escapeHtml(info.color)}"></pi-swatch>`;
        const live = info.liveColorFrom ? `<div class="pi-hint">${escapeHtml(t('kit.panorama_color_live', { from: info.liveColorFrom }))}</div>` : '';
        return `<div class="pi-pano-field pi-pano-color"><span class="pi-label">${escapeHtml(t('kit.panorama_color'))}</span>
            <div class="pi-choice" style="--pi-choice-columns: 3">${tiles.join('')}</div>${detail}${live}</div>`;
    }

    private wireColor(info: Info): void {
        const set = (value: string) => sd.sendToPlugin({ event: 'panorama-set', settings: { [COLOR_KEY]: value } });
        this.querySelectorAll<HTMLElement>('[data-color-mode]').forEach((el) =>
            el.addEventListener('click', () => {
                const mode = el.dataset.colorMode!;
                if (mode === colorMode(info.color)) return;
                // A fixed colour starts from the cover colour shown now, else white
                if (mode === 'fixed') set(info.covers.find((c) => c.playing)?.color ?? info.covers[0]?.color ?? '#FFFFFF');
                else set(mode);
            }),
        );
        this.querySelector<HTMLSelectElement>('[data-color-player]')?.addEventListener('change', (e) => set((e.target as HTMLSelectElement).value));
        this.querySelector<HTMLElement & { value: string }>('[data-color-fixed]')?.addEventListener('change', (e) => set((e.target as HTMLElement & { value: string }).value));
    }

    private renderSummary(info: Info): void {
        const members = info.dials.filter((d) => d.member).length;
        const text = info.effect === NONE ? t('kit.panorama_none') : t('kit.panorama_summary', { effect: this.effectName(info.effect), n: members, m: info.dials.length });
        this.innerHTML = `
            <div class="pi-section-title">${escapeHtml(t('kit.panorama'))}</div>
            <button type="button" class="pi-card pi-pano-summary"><span class="pi-label">${escapeHtml(text)}</span><span class="pi-hint">${escapeHtml(t('kit.panorama_change'))}</span></button>`;
        this.querySelector('button')!.addEventListener('click', () => {
            if (!openSettingsWindow('panorama')) showSettingsInline();
        });
    }

    private fieldHtml(effectId: string, f: Field, value: unknown): string {
        const label = escapeHtml(tr(`effect.${effectId}.${f.key}`, f.label));
        const key = escapeHtml(f.key);
        switch (f.type) {
            case 'range': {
                const step = f.step ?? ((f.max ?? 1) - (f.min ?? 0) <= 2 ? 0.05 : 1);
                return `<label class="pi-pano-field"><span class="pi-label">${label}</span><span class="pi-pano-range"><input type="range" data-key="${key}" min="${f.min}" max="${f.max}" step="${step}" value="${Number(value)}"/><span class="pi-hint" data-value="${key}">${Number(value)}</span></span></label>`;
            }
            case 'color':
                return `<div class="pi-pano-field pi-pano-inline"><span class="pi-label">${label}</span><pi-swatch data-key="${key}" value="${escapeHtml(String(value))}"></pi-swatch></div>`;
            case 'checkbox':
                return `<label class="pi-pano-field pi-pano-inline"><span class="pi-label">${label}</span><input type="checkbox" data-key="${key}" ${value ? 'checked' : ''}/></label>`;
            case 'select':
                return `<label class="pi-pano-field"><span class="pi-label">${label}</span><select class="pi-input" data-key="${key}">${(f.options ?? []).map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`;
        }
    }

    private wireFields(): void {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const send = (key: string, value: unknown, now = false) => {
            clearTimeout(timer);
            const go = () => sd.sendToPlugin({ event: 'panorama-set', settings: { [key]: value } });
            if (now) go();
            else timer = setTimeout(go, 80);
        };
        this.querySelectorAll<HTMLInputElement>('.pi-pano-fields input[type=range]').forEach((el) => {
            el.addEventListener('input', () => {
                const shown = this.querySelector<HTMLElement>(`[data-value="${el.dataset.key}"]`);
                if (shown) shown.textContent = el.value;
                send(el.dataset.key!, Number(el.value));
            });
        });
        this.querySelectorAll<HTMLInputElement>('.pi-pano-fields input[type=checkbox]').forEach((el) => el.addEventListener('change', () => send(el.dataset.key!, el.checked, true)));
        this.querySelectorAll<HTMLSelectElement>('.pi-pano-fields select').forEach((el) => el.addEventListener('change', () => send(el.dataset.key!, el.value, true)));
        this.querySelectorAll<HTMLElement & { value: string }>('.pi-pano-fields pi-swatch').forEach((el) => el.addEventListener('change', () => send(el.dataset.key!, el.value, true)));
    }

    /** Same structure: only the values (the effect was tuned elsewhere, e.g. by turning a dial). */
    private updateValues(info: Info): void {
        for (const [key, value] of Object.entries(info.settings)) {
            const input = this.querySelector<HTMLInputElement>(`.pi-pano-fields input[data-key="${key}"]`);
            if (!input || input === document.activeElement) continue;
            if (input.type === 'checkbox') input.checked = !!value;
            else {
                input.value = String(value);
                const shown = this.querySelector<HTMLElement>(`[data-value="${key}"]`);
                if (shown) shown.textContent = String(value);
            }
        }
    }
}
