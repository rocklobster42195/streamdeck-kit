// Takes secrets out of log text before it is shown or copied into an issue (grill 2026-10-10):
// tokens, passwords, credentials in URLs, e-mail addresses and long opaque strings. Private IP
// addresses stay (they help with network faults and say nothing outside the home).

const MASK = '‹hidden›';

const RULES: [RegExp, string][] = [
    // Authorization headers and bearer tokens
    [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${MASK}`],
    // key=value and "key": "value" for names that hold secrets
    [/\b((?:access[_-]?|auth[_-]?|api[_-]?|refresh[_-]?|long[_-]?lived[_-]?)?(?:token|password|passwd|secret|passphrase|apikey|api[_-]?key))(["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi, `$1$2${MASK}`],
    // credentials in a URL: scheme://user:password@host
    [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${MASK}@`],
    // e-mail addresses
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, MASK],
    // long opaque strings (tokens, keys): 32+ characters of base64/hex/JWT alphabet without a path or space
    [/\b[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]{8,}){0,2}\b/g, MASK],
];

/** The text with tokens, passwords, credentials in URLs and e-mail addresses replaced by "‹hidden›". */
export function redactLog(text: string): string {
    let out = text;
    for (const [re, to] of RULES) out = out.replace(re, to);
    return out;
}
