// Where the kit reports problems (a cover that failed to load, a throwing effect). Plugins route it
// to their own logger once at startup: setKitLogger(streamDeck.logger).
export type KitLogger = { warn(...args: unknown[]): void; error(...args: unknown[]): void; info?(...args: unknown[]): void };

let logger: KitLogger = console;

export function setKitLogger(l: KitLogger): void {
    logger = l;
}

export function kitLog(): KitLogger {
    return logger;
}
