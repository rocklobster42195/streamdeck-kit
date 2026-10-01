// <pi-thresholds setting="thresholds" [base-setting="color"] [base-default="#F7A600"] [unit="°C" | unit-setting="unit"]
//                [min-setting="min"] [max-setting="max"] [default-min="0"] [default-max="100"]>
// Colour ranges for a value: a base colour (below the first threshold) and any number of
// "from <value>: <colour>" rows, with a bar that previews them between min and max. Stored as
// [{ from, color }] sorted by `from` (the kit's Zones without the base).
import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';

export type Threshold = { from: number; color: string };

/** The kit's house palette steps, offered in turn for new rows. */
const NEXT_COLORS = ['#3ddc84', '#f5c542', '#ff4d4d', '#6cc4ff', '#E14190'];

export class PiThresholds extends HTMLElement {
    private off?: () => void;

    private get key(): string {
        return this.getAttribute('setting') ?? 'thresholds';
    }

    private get rows(): Threshold[] {
        const raw = sd.settings[this.key];
        return Array.isArray(raw) ? (raw as Threshold[]).filter((r) => r && Number.isFinite(Number(r.from)) && typeof r.color === 'string').map((r) => ({ from: Number(r.from), color: r.color })) : [];
    }

    private get base(): string {
        const k = this.getAttribute('base-setting');
        return String((k && sd.settings[k]) || this.getAttribute('base-default') || '#ffffff');
    }

    connectedCallback(): void {
        this.classList.add('pi-thresholds');
        this.off = sd.onSettings(() => this.render());
        this.render();
    }

    disconnectedCallback(): void {
        this.off?.();
    }

    /** A fixed unit, or the one the user typed into another setting. */
    private get unit(): string {
        const k = this.getAttribute('unit-setting');
        return this.getAttribute('unit') ?? (k ? String(sd.settings[k] ?? '') : '');
    }

    private save(rows: Threshold[]): void {
        sd.setSetting(this.key, [...rows].sort((a, b) => a.from - b.from));
    }

    private range(): [number, number] {
        const num = (key: string | null, def: string | null, fallback: number) => {
            const raw = key ? sd.settings[key] : undefined;
            const v = raw === undefined || raw === '' ? Number.NaN : Number(raw);
            return Number.isFinite(v) ? v : Number(def ?? fallback);
        };
        let min = num(this.getAttribute('min-setting'), this.getAttribute('default-min'), 0);
        let max = num(this.getAttribute('max-setting'), this.getAttribute('default-max'), 100);
        // Without a min/max setting, the preview grows to show every threshold (e.g. 1000 W)
        const froms = this.rows.map((r) => r.from);
        if (froms.length && !this.getAttribute('max-setting') && Math.max(...froms) >= max) max = Math.max(...froms) * 1.25 || Math.max(...froms) + 1;
        if (froms.length && !this.getAttribute('min-setting') && Math.min(...froms) <= min) min = Math.min(...froms) - (max - Math.min(...froms)) * 0.2;
        return max > min ? [min, max] : [min, min + 1];
    }

    private render(): void {
        // Keep focus while typing: the row being edited re-renders only on change
        if (this.contains(document.activeElement) && (document.activeElement as HTMLInputElement).type === 'number') return;
        const rows = this.rows;
        const unit = this.unit;
        const baseKey = this.getAttribute('base-setting');
        this.innerHTML = `
            <div class="pi-thresholds-bar"></div>
            <div class="pi-thresholds-scale"><span></span><span></span></div>
            ${baseKey ? `<div class="pi-row pi-thresholds-row"><span class="pi-label pi-thresholds-from">${escapeHtml(t('kit.threshold_base'))}</span><input class="pi-color" type="color" data-base value="${escapeHtml(this.base)}"/></div>` : ''}
            ${rows
                .map(
                    (r, i) => `<div class="pi-row pi-thresholds-row">
                        <span class="pi-label pi-thresholds-from">${escapeHtml(t('kit.threshold_from'))}</span>
                        <input class="pi-input pi-thresholds-value" type="number" step="any" data-i="${i}" value="${r.from}"/>
                        <span class="pi-hint">${escapeHtml(unit)}</span>
                        <input class="pi-color" type="color" data-i="${i}" value="${escapeHtml(r.color)}"/>
                        <button type="button" class="pi-icon-button pi-thresholds-remove" data-i="${i}" aria-label="${escapeHtml(t('kit.threshold_remove'))}">×</button>
                    </div>`,
                )
                .join('')}
            <div class="pi-padded"><button type="button" class="pi-button pi-button-small pi-thresholds-add">${escapeHtml(t('kit.threshold_add'))}</button></div>`;
        this.renderBar(rows);

        this.querySelector<HTMLInputElement>('input[data-base]')?.addEventListener('change', (e) => sd.setSetting(baseKey!, (e.target as HTMLInputElement).value));
        this.querySelectorAll<HTMLInputElement>('.pi-thresholds-value').forEach((el) =>
            el.addEventListener('change', () => {
                const v = Number(el.value);
                if (!Number.isFinite(v)) return;
                const next = this.rows;
                next[Number(el.dataset.i)].from = v;
                el.blur();
                this.save(next);
            }),
        );
        this.querySelectorAll<HTMLInputElement>('.pi-color[data-i]').forEach((el) => {
            // Preview while dragging, save on release
            el.addEventListener('input', () => {
                const next = this.rows;
                next[Number(el.dataset.i)].color = el.value;
                this.renderBar(next);
            });
            el.addEventListener('change', () => {
                const next = this.rows;
                next[Number(el.dataset.i)].color = el.value;
                this.save(next);
            });
        });
        this.querySelectorAll<HTMLElement>('.pi-thresholds-remove').forEach((el) =>
            el.addEventListener('click', () => this.save(this.rows.filter((_, i) => i !== Number(el.dataset.i)))),
        );
        this.querySelector('.pi-thresholds-add')!.addEventListener('click', () => {
            const [min, max] = this.range();
            const last = rows.length ? rows[rows.length - 1].from : min;
            const from = Math.round(rows.length ? last + (max - last) / 2 : min + (max - min) / 2);
            this.save([...rows, { from, color: NEXT_COLORS[rows.length % NEXT_COLORS.length] }]);
        });
    }

    private renderBar(rows: Threshold[]): void {
        const [min, max] = this.range();
        const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
        const stops: string[] = [];
        let color = this.base;
        let at = 0;
        for (const r of [...rows].sort((a, b) => a.from - b.from)) {
            const p = pct(r.from);
            stops.push(`${color} ${at}%`, `${color} ${p}%`);
            color = r.color;
            at = p;
        }
        stops.push(`${color} ${at}%`, `${color} 100%`);
        this.querySelector<HTMLElement>('.pi-thresholds-bar')!.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
        const unit = this.unit;
        const [a, b] = this.querySelectorAll<HTMLElement>('.pi-thresholds-scale span');
        a.textContent = `${min}${unit ? ` ${unit}` : ''}`;
        b.textContent = `${max}${unit ? ` ${unit}` : ''}`;
    }
}
