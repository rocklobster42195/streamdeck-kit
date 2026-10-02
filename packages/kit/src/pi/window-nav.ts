// The settings window's menu: the visible sections (every <pi-section>, and elements marked
// data-window-section="<i18n key of the menu entry>"), as a bar at the top that wraps and stays
// while scrolling, or a fixed column on the left in a window wider than Stream Deck's 500 px. A
// click scrolls to one; the one in view is highlighted (scroll spy). Hidden sections are left out.
import { escapeHtml } from './dom.js';
import { t } from './i18n.js';
import { sd } from './sd-client.js';

type Entry = { el: HTMLElement; title: string };

export function initWindowNav(): void {
    const nav = document.createElement('nav');
    nav.className = 'pi-window-nav';
    document.body.prepend(nav);
    let entries: Entry[] = [];
    // Ids stay once given; a counter, as sections appear later (e.g. after the plugin's first answer)
    let nextId = 0;

    const sections = (): Entry[] => {
        const out: Entry[] = [];
        document.querySelectorAll<HTMLElement>('pi-section, [data-window-section]').forEach((el) => {
            if (el.hidden || el.closest('[hidden]') || getComputedStyle(el).display === 'none') return;
            // pi-section moves its title attribute into a .pi-section-title element when it is built
            const key = el.dataset.windowSection;
            const title = key ? t(key) : (el.querySelector(':scope > .pi-section-title')?.textContent ?? '');
            // Short entries: "Second line (optional)" → "Second line"
            if (title) out.push({ el, title: title.replace(/\s*\(.*\)\s*$/, '') });
        });
        return out;
    };

    let shown = '';
    const render = () => {
        entries = sections();
        for (const e of entries) e.el.id ||= `pi-sec-${nextId++}`;
        // Only when the sections changed: plugins send messages often (e.g. a preview per frame),
        // and new links between mouse down and up would swallow the click
        const html = entries.map((e) => `<a href="#${e.el.id}" data-id="${e.el.id}">${escapeHtml(e.title)}</a>`).join('');
        if (html === shown) return spy();
        shown = html;
        nav.innerHTML = html;
        // Sections scrolled to stop under the bar, however many lines it wraps to
        const bar = getComputedStyle(nav).position === 'sticky' ? nav.getBoundingClientRect().height : 0;
        document.documentElement.style.setProperty('--pi-window-nav-height', `${Math.round(bar)}px`);
        spy();
    };

    /** The last section whose top has passed a line a little below the window's top. */
    const spy = () => {
        // Just under the menu bar when it sits on top (narrow window), else near the top
        const line = (getComputedStyle(nav).position === 'sticky' ? nav.getBoundingClientRect().bottom : 0) + 40;
        let current = entries[0];
        for (const e of entries) if (e.el.getBoundingClientRect().top <= line) current = e;
        // At the very bottom, the last section counts even if its top never reaches the line
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = entries[entries.length - 1];
        nav.querySelectorAll<HTMLElement>('a').forEach((a) => a.classList.toggle('active', a.dataset.id === current?.el.id));
    };

    nav.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a) return;
        e.preventDefault();
        document.getElementById(a.dataset.id ?? '')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.addEventListener('scroll', spy, { passive: true });
    // Sections come and go with the settings and the plugin's answers
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
        clearTimeout(timer);
        timer = setTimeout(render, 50);
    };
    sd.onSettings(later);
    sd.onGlobalSettings(later);
    sd.onMessage(later);
    render();
}
