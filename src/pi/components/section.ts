import { t } from '../i18n.js';

/** <pi-section title="pi.display">…children…</pi-section> — a section title and a card around the children. */
export class PiSection extends HTMLElement {
    private built = false;
    connectedCallback(): void {
        if (this.built) return;
        this.built = true;
        const body = document.createElement('div');
        body.className = 'pi-card';
        body.append(...Array.from(this.childNodes));
        const title = this.getAttribute('title');
        this.removeAttribute('title'); // avoid the native tooltip
        if (title) {
            const h = document.createElement('div');
            h.className = 'pi-section-title';
            h.textContent = t(title);
            this.append(h);
        }
        this.append(body);
    }
}
