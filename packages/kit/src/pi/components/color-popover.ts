// The colour picker's popover, under the swatch that opened it: "automatic" (when allowed), the
// standard colours, the recent colours, a colour wheel (hue = angle, saturation = distance from the
// centre) with a brightness slider, and hex and R/G/B fields. Dragging previews (onInput), letting
// go, a swatch or a typed value picks (onChange). One popover at a time; Escape or a click outside
// closes it.
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex, type Hsv } from '../color-math.js';
import { escapeHtml } from '../dom.js';
import { recentColors, rememberColor, STANDARD_COLORS } from '../standard-colors.js';
import { t } from '../i18n.js';

export type ColorPopoverOptions = {
    /** "#RRGGBB", or "auto" when `auto` is allowed. */
    value: string;
    /** Offer "automatic" (stored as "auto"): e.g. the device's own colour. */
    auto?: boolean;
    onInput?: (value: string) => void;
    onChange: (value: string) => void;
};

const WHEEL = 148;
let open: { el: HTMLElement; close: () => void } | undefined;

export function closeColorPopover(): void {
    open?.close();
}

export function openColorPopover(anchor: HTMLElement, opts: ColorPopoverOptions): void {
    closeColorPopover();
    let hsv: Hsv = hexToHsv(opts.value) ?? { h: 36, s: 1, v: 0.97 };
    const el = document.createElement('div');
    el.className = 'pi-color-popover';
    const swatch = (hex: string, name?: string) => `<button type="button" class="pi-color-chip" data-hex="${hex}" style="background:${hex}" title="${escapeHtml(name ? `${name} ${hex}` : hex)}" aria-label="${escapeHtml(name ?? hex)}"></button>`;
    const recent = recentColors();
    el.innerHTML = `
        ${opts.auto ? `<button type="button" class="pi-button pi-button-small pi-color-auto">${escapeHtml(t('kit.color_auto'))}</button>` : ''}
        <div class="pi-color-title">${escapeHtml(t('kit.color_standard'))}</div>
        <div class="pi-color-chips">${STANDARD_COLORS.map((c) => swatch(c.hex, c.name)).join('')}</div>
        ${recent.length ? `<div class="pi-color-title">${escapeHtml(t('kit.color_recent'))}</div><div class="pi-color-chips">${recent.map((c) => swatch(c)).join('')}</div>` : ''}
        <div class="pi-color-mixer">
            <div class="pi-color-wheel"><canvas width="${WHEEL}" height="${WHEEL}"></canvas><span class="pi-color-thumb"></span></div>
            <div class="pi-color-fields">
                <span class="pi-color-preview"></span>
                <label><span class="pi-hint">Hex</span><input class="pi-input pi-color-hexin" spellcheck="false" maxlength="7"/></label>
                <div class="pi-color-rgb">${['r', 'g', 'b'].map((c) => `<label><span class="pi-hint">${c.toUpperCase()}</span><input class="pi-input" type="number" min="0" max="255" data-c="${c}"/></label>`).join('')}</div>
            </div>
        </div>
        <label class="pi-color-bright"><span class="pi-hint">${escapeHtml(t('kit.color_brightness'))}</span><input type="range" min="0" max="100" class="pi-color-v"/></label>`;
    document.body.append(el);
    place(el, anchor);

    const canvas = el.querySelector('canvas')!;
    const thumb = el.querySelector<HTMLElement>('.pi-color-thumb')!;
    const bright = el.querySelector<HTMLInputElement>('.pi-color-v')!;
    const hexIn = el.querySelector<HTMLInputElement>('.pi-color-hexin')!;
    const rgbIns = [...el.querySelectorAll<HTMLInputElement>('.pi-color-rgb input')];
    drawWheel(canvas);

    const current = () => hsvToHex(hsv);
    const show = (except?: HTMLElement) => {
        const hex = current();
        const r = WHEEL / 2;
        const a = (hsv.h * Math.PI) / 180;
        thumb.style.left = `${r + Math.cos(a) * hsv.s * (r - 2)}px`;
        thumb.style.top = `${r - Math.sin(a) * hsv.s * (r - 2)}px`;
        thumb.style.background = hsvToHex({ ...hsv, v: 1 });
        canvas.style.filter = `brightness(${Math.max(0.15, hsv.v)})`;
        bright.value = String(Math.round(hsv.v * 100));
        bright.style.setProperty('--pi-color-full', hsvToHex({ ...hsv, v: 1 }));
        el.querySelector<HTMLElement>('.pi-color-preview')!.style.background = hex;
        if (except !== hexIn) hexIn.value = hex;
        const rgb = hexToRgb(hex)!;
        for (const inp of rgbIns) if (inp !== except) inp.value = String(rgb[inp.dataset.c as 'r' | 'g' | 'b']);
        el.querySelectorAll<HTMLElement>('.pi-color-chip').forEach((c) => c.classList.toggle('active', c.dataset.hex === hex));
    };
    const pick = (hex: string) => {
        rememberColor(hex);
        opts.onChange(hex);
    };

    // Wheel: drag to preview, let go to pick
    const fromPointer = (e: PointerEvent) => {
        const box = canvas.getBoundingClientRect();
        const x = e.clientX - box.left - box.width / 2;
        const y = box.height / 2 - (e.clientY - box.top);
        hsv = { ...hsv, h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(x, y) / (box.width / 2 - 2)) };
        if (hsv.v < 0.15) hsv.v = 1;
        show();
        opts.onInput?.(current());
    };
    const wheel = el.querySelector<HTMLElement>('.pi-color-wheel')!;
    wheel.addEventListener('pointerdown', (e) => {
        wheel.setPointerCapture(e.pointerId);
        fromPointer(e);
        const move = (ev: PointerEvent) => fromPointer(ev);
        const up = () => {
            wheel.removeEventListener('pointermove', move);
            pick(current());
        };
        wheel.addEventListener('pointermove', move);
        wheel.addEventListener('pointerup', up, { once: true });
    });
    bright.addEventListener('input', () => {
        hsv = { ...hsv, v: Number(bright.value) / 100 };
        show();
        opts.onInput?.(current());
    });
    bright.addEventListener('change', () => pick(current()));
    hexIn.addEventListener('input', () => {
        const hex = normalizeHex(hexIn.value);
        if (!hex) return;
        hsv = hexToHsv(hex)!;
        show(hexIn);
        opts.onInput?.(hex);
    });
    hexIn.addEventListener('change', () => {
        const hex = normalizeHex(hexIn.value);
        if (hex) pick(hex);
        show();
    });
    for (const inp of rgbIns)
        inp.addEventListener('change', () => {
            const rgb = Object.fromEntries(rgbIns.map((i) => [i.dataset.c, Number(i.value) || 0])) as { r: number; g: number; b: number };
            const hex = rgbToHex(rgb);
            hsv = hexToHsv(hex)!;
            show();
            pick(hex);
        });
    el.querySelectorAll<HTMLElement>('.pi-color-chip').forEach((c) =>
        c.addEventListener('click', () => {
            hsv = hexToHsv(c.dataset.hex!)!;
            show();
            pick(c.dataset.hex!);
        }),
    );
    el.querySelector('.pi-color-auto')?.addEventListener('click', () => {
        opts.onChange('auto');
        close();
    });

    const onDown = (e: PointerEvent) => {
        if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const close = () => {
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey);
        el.remove();
        if (open?.el === el) open = undefined;
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    open = { el, close };
    show();
}

/** Under the anchor, as wide as the page allows; above it when there is no room below. */
function place(el: HTMLElement, anchor: HTMLElement): void {
    const a = anchor.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(340, document.documentElement.clientWidth - margin * 2);
    el.style.width = `${width}px`;
    el.style.left = `${Math.max(margin, Math.min(a.right - width, document.documentElement.clientWidth - width - margin)) + window.scrollX}px`;
    const below = a.bottom + 6;
    const fitsBelow = below + el.offsetHeight < window.innerHeight || a.top < el.offsetHeight + 12;
    el.style.top = `${(fitsBelow ? below : a.top - el.offsetHeight - 6) + window.scrollY}px`;
}

/** The colour disc at full brightness: hue around, white in the centre. */
function drawWheel(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const r = size / 2;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - r + 0.5;
            const dy = r - y - 0.5;
            const d = Math.hypot(dx, dy);
            const i = (y * size + x) * 4;
            if (d > r) continue;
            const rgb = hexToRgb(hsvToHex({ h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s: Math.min(1, d / (r - 2)), v: 1 }))!;
            img.data[i] = rgb.r;
            img.data[i + 1] = rgb.g;
            img.data[i + 2] = rgb.b;
            // Soft edge
            img.data[i + 3] = d > r - 1 ? Math.round(255 * (r - d)) : 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}
