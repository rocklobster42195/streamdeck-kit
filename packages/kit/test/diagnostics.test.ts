import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@elgato/streamdeck', () => ({
    default: { info: { plugin: { uuid: 'de.test.plugin', version: '1.2.3' }, application: { version: '7.1', platform: 'windows', language: 'de' } }, ui: {}, logger: { info() {}, warn() {} } },
}));
const { redactLog } = await import('../src/redact.js');
const { registerDiagnostics, tailLines } = await import('../src/diagnostics.js');

describe('redactLog', () => {
    it('hides tokens, passwords, credentials in URLs and e-mail addresses; keeps private IPs', () => {
        const out = redactLog('connect http://192.168.7.136:8123 with Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnop token=abc123def456 user@example.com mqtt://boris:geheim@192.168.7.135:1883 "password": "hunter2"');
        expect(out).toContain('192.168.7.136');
        expect(out).toContain('192.168.7.135');
        expect(out).not.toMatch(/eyJhbGci|abc123def456|user@example|geheim|hunter2/);
        expect(out.match(/‹hidden›/g)?.length).toBeGreaterThanOrEqual(5);
    });

    it('hides a long opaque key but not a normal word or an id', () => {
        expect(redactLog('key 0123456789abcdef0123456789abcdef0123 end')).toContain('‹hidden›');
        expect(redactLog('player RINCON_38420B857BB201400 plays Skyhug')).toContain('RINCON_38420B857BB201400');
    });
});

describe('diagnostics', () => {
    it('gives the end of the log, redacted, and a header', async () => {
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kitdiag-')), 'p.0.log');
        fs.writeFileSync(file, ['one', 'two', 'WARN something token=secretsecret1', 'three'].join('\n') + '\n');
        expect(tailLines(file, 2)).toEqual(['WARN something token=‹hidden›', 'three']);
        const handlers = new Map<string, (m: unknown) => unknown>();
        const replies: unknown[] = [];
        registerDiagnostics({ handle: (e: string, h: (m: unknown) => unknown) => void handlers.set(e, h), reply: async (m: unknown) => void replies.push(m) } as never, {
            logFile: file,
            issueUrl: 'https://example.invalid/issues',
            peers: () => [{ name: 'MA-C', version: '0.1.0' }],
            extra: () => ({ 'Music Assistant': 'connected', unset: undefined }),
        });
        await handlers.get('kit-diag-request')!({ event: 'kit-diag-request' });
        const r = replies[0] as { header: string[]; lines: string[]; issueUrl: string };
        expect(r.lines.at(-1)).toBe('three');
        expect(r.issueUrl).toBe('https://example.invalid/issues');
        expect(r.header.join('\n')).toContain('de.test.plugin 1.2.3');
        expect(r.header.join('\n')).toContain('MA-C 0.1.0');
        expect(r.header.join('\n')).toContain('Music Assistant: connected');
        expect(r.header.join('\n')).not.toContain('unset');
    });
});
