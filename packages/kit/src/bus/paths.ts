// Where deckbus peers meet and the key that keeps other users out.
//  - Windows: named pipes live in one global namespace, so the pipe name carries a hash of the user
//    name: \\.\pipe\deckbus-<userhash>-<slot>.
//  - macOS/Linux: a Unix socket per slot in the user's own temp directory: deckbus-<slot>.sock.
//  - Key: 32 random bytes in a file only the user can read (created on first use).
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Short, stable tag of the current user (keeps two logged-in users' pipes apart on Windows). */
export function userTag(): string {
    return crypto.createHash("sha1").update(os.userInfo().username).digest("hex").slice(0, 8);
}

/** Address of a slot. `namespace` is "deckbus" in real use; tests use their own. */
export function slotAddress(slot: number, namespace = "deckbus"): string {
    return process.platform === "win32" ? `\\\\.\\pipe\\${namespace}-${userTag()}-${slot}` : path.join(os.tmpdir(), `${namespace}-${slot}.sock`);
}

/** %APPDATA%\deckbus, ~/Library/Application Support/deckbus, or ~/.config/deckbus. */
export function defaultKeyDir(): string {
    const home = os.homedir();
    if (process.platform === "win32") return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "deckbus");
    if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "deckbus");
    return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "deckbus");
}

/** The bus key from `dir/key`, created (readable by the user only) when missing. */
export async function readOrCreateKey(dir = defaultKeyDir()): Promise<string> {
    const file = path.join(dir, "key");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try {
        // "wx": only one of several plugins starting at once creates it; the others read it
        fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    for (let i = 0; i < 20; i++) {
        const key = fs.readFileSync(file, "utf8").trim();
        if (key) return key;
        await new Promise((r) => setTimeout(r, 25)); // another plugin is still writing it
    }
    throw new Error(`deckbus key file ${file} is empty`);
}
