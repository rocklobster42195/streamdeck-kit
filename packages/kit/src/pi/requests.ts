let lastRequestId = 0;

/** Ids for requests to the plugin — one counter for all components, so replies can't reach the wrong one. */
export function nextRequestId(): number {
    return ++lastRequestId;
}
