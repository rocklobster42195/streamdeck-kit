import { escapeHtml } from '../dom.js';
import { t } from '../i18n.js';
import { sd } from '../sd-client.js';

type Row = { player: string; name: string; mode?: 'pause' | 'duck' };
type Message = { event?: string; available?: boolean; players?: Row[] };

const SETTING = 'callReaction';
const EVENT = 'kit-call-players';
const MODES = [
    { value: '', label: 'kit.call_nothing' },
    { value: 'pause', label: 'kit.call_pause' },
    { value: 'duck', label: 'kit.call_duck' },
] as const;

/**
 * <pi-call-reaction> — "When a call starts on this computer" (players/call-reaction.ts): one row
 * per player of the plugin (pushed as "kit-call-players"), each Nothing / Pause / Lower; writes the
 * global setting `callReaction` ({ "<player>": "pause" | "duck" }). A call comes from another
 * plugin on deckbus (SA-C), so the hint says so; without such a plugin the whole section hides
 * (the choices stay).
 */
export class PiCallReaction extends HTMLElement {
    private rows: Row[] = [];
    private off?: () => void;

    connectedCallback(): void {
        this.off = sd.onMessage((msg: Message) => {
            if (msg?.event !== EVENT || !Array.isArray(msg.players)) return;
            this.rows = msg.players;
            this.show(msg.available === true);
            this.render();
        });
        this.show(false);
        this.render();
    }

    disconnectedCallback(): void {
        this.off?.();
    }

    /** The whole section (its title too) only while some plugin reports calls. */
    private show(on: boolean): void {
        const section = this.closest('pi-section') as HTMLElement | null;
        (section ?? this).hidden = !on;
    }

    private render(): void {
        const hint = `<div class="pi-hint pi-call-hint">${escapeHtml(t('kit.call_hint'))}</div>`;
        if (!this.rows.length) {
            this.innerHTML = `<div class="pi-row"><span class="pi-hint">${escapeHtml(t('kit.call_no_players'))}</span></div>${hint}`;
            return;
        }
        this.innerHTML =
            this.rows
                .map(
                    (r) => `<div class="pi-call-row">
                <div class="pi-label">${escapeHtml(r.name)}</div>
                <div class="pi-choice" style="--pi-choice-columns:3">${MODES.map(
                    (m) => `<button type="button" class="pi-choice-tile" data-player="${escapeHtml(r.player)}" data-mode="${m.value}" aria-pressed="${(r.mode ?? '') === m.value}"><span>${escapeHtml(t(m.label))}</span></button>`,
                ).join('')}</div>
            </div>`,
                )
                .join('') + hint;
        this.querySelectorAll<HTMLButtonElement>('button[data-player]').forEach((b) => b.addEventListener('click', () => this.choose(b.dataset.player ?? '', b.dataset.mode ?? '')));
    }

    private choose(player: string, mode: string): void {
        const row = this.rows.find((r) => r.player === player);
        if (!row) return;
        const current = sd.globalSettings[SETTING];
        const next: Record<string, string> = current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as Record<string, string>) } : {};
        if (mode === 'pause' || mode === 'duck') next[player] = row.mode = mode;
        else {
            delete next[player];
            delete row.mode;
        }
        sd.setGlobalSetting(SETTING, next);
        this.render();
    }
}
